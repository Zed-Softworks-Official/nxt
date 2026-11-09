import type { Doc, Id } from '@nxt/backend/dataModel'
import type { MutationCtx, QueryCtx } from '@nxt/backend/server'
import { v } from 'convex/values'
import { parsePingNote } from '../pingNote'
import { meetsSubRequirement } from '../subRequirement'
import {
    announcePinged,
    dropPendingForParticipant,
    pendingSinceByReference,
} from './announcement'
import { insertPausedQueue, queueForCommunity } from './pausedQueue'

// The platform-neutral Queue module. Every entry point (platform adapters
// through a Platform Link, the dashboard through its owner) resolves a Queue
// and then calls these operations, which return discriminated results.

export const platform = v.union(
    v.literal('discord'),
    v.literal('twitch'),
    v.literal('youtube')
)

export type Platform = 'discord' | 'twitch' | 'youtube'

export const platformLink = v.object({
    platform,
    platformId: v.string(),
})

export type PlatformLinkRef = { platform: Platform; platformId: string }

export type QueueDoc = Doc<'queues'>

// ---- Resolving a Queue --------------------------------------------------

export async function enabledLink(
    ctx: QueryCtx | MutationCtx,
    link: PlatformLinkRef
) {
    const row = await ctx.db
        .query('platformLinks')
        .withIndex('byPlatform', (q) =>
            q.eq('platform', link.platform).eq('platformId', link.platformId)
        )
        .first()
    if (!row || !row.enabled) return null
    return row
}

// Read-only: a Community with no Queue row yet reads as an empty Paused Queue.
export async function queueForLink(ctx: QueryCtx, link: PlatformLinkRef) {
    const row = await enabledLink(ctx, link)
    if (!row) return null
    return {
        communityId: row.communityId,
        queue: await queueForCommunity(ctx, row.communityId),
    }
}

// For mutations: inserts the Paused Queue if the Community has none yet.
export async function requireQueueForLink(
    ctx: MutationCtx,
    link: PlatformLinkRef
): Promise<QueueDoc | null> {
    const row = await enabledLink(ctx, link)
    if (!row) return null
    return await ensureQueue(ctx, row.communityId)
}

export async function ensureQueue(
    ctx: MutationCtx,
    communityId: Id<'communities'>
): Promise<QueueDoc> {
    const existing = await queueForCommunity(ctx, communityId)
    if (existing) return existing
    const queueId = await insertPausedQueue(ctx, communityId)
    const queue = await ctx.db.get('queues', queueId)
    if (!queue) throw new Error('Queue not found')
    return queue
}

// ---- Results --------------------------------------------------------------

export const unlinked = v.object({ kind: v.literal('unlinked') })

// A Sub requirement that is on.
export const activeSubRequirement = v.union(
    v.literal('any'),
    v.literal('tier2'),
    v.literal('tier3')
)

export const subRequirementSetting = v.union(
    v.literal('off'),
    activeSubRequirement
)

export const joinResult = v.union(
    v.object({ kind: v.literal('ok'), reference: v.number() }),
    v.object({ kind: v.literal('paused') }),
    v.object({ kind: v.literal('joins_off') }),
    v.object({ kind: v.literal('already'), reference: v.number() }),
    // The caller must look up the person's sub tier and join again with it.
    v.object({
        kind: v.literal('sub_check_needed'),
        requirement: activeSubRequirement,
    }),
    v.object({
        kind: v.literal('sub_required'),
        requirement: activeSubRequirement,
    })
)

// ---- Operations -----------------------------------------------------------

type Who = {
    platform: Platform
    platformUserId: string
}

async function findParticipant(
    ctx: QueryCtx | MutationCtx,
    queueId: Id<'queues'>,
    who: Who
) {
    return await ctx.db
        .query('participants')
        .withIndex('byUser', (q) =>
            q
                .eq('platformUserId', who.platformUserId)
                .eq('platform', who.platform)
                .eq('queueId', queueId)
        )
        .first()
}

async function nextReference(ctx: MutationCtx, communityId: Id<'communities'>) {
    const community = await ctx.db.get('communities', communityId)
    if (!community) throw new Error('Community not found')
    const reference = (community.lastReference ?? 0) + 1
    await ctx.db.patch('communities', communityId, { lastReference: reference })
    return reference
}

export async function join(
    ctx: MutationCtx,
    queue: QueueDoc,
    who: Who & { username: string; login?: string; channelId?: string },
    link: Pick<Doc<'platformLinks'>, 'joinsOff' | 'twitch'>,
    // What is known about the person's sub: exempt as a Twitch Admin, or their
    // tier (0 for none). Absent until someone has looked it up.
    sub?: { exempt?: boolean; tier?: number }
) {
    const existing = await findParticipant(ctx, queue._id, who)
    if (existing) {
        const changes = {
            ...(who.channelId && existing.lastChannelId !== who.channelId
                ? { lastChannelId: who.channelId }
                : {}),
            ...(who.login && existing.login !== who.login
                ? { login: who.login }
                : {}),
        }
        if (Object.keys(changes).length > 0) {
            await ctx.db.patch('participants', existing._id, changes)
        }
        return { kind: 'already' as const, reference: existing.reference }
    }
    if (queue.state !== 'open') return { kind: 'paused' as const }
    if (link.joinsOff) return { kind: 'joins_off' as const }

    const requirement = link.twitch?.subRequirement
    if (requirement && !sub?.exempt) {
        if (sub?.tier === undefined) {
            return { kind: 'sub_check_needed' as const, requirement }
        }
        if (!meetsSubRequirement(requirement, sub.tier)) {
            return { kind: 'sub_required' as const, requirement }
        }
    }

    const reference = await nextReference(ctx, queue.communityId)
    await ctx.db.insert('participants', {
        queueId: queue._id,
        reference,
        username: who.username,
        ...(who.login ? { login: who.login } : {}),
        platform: who.platform,
        platformUserId: who.platformUserId,
        ...(who.channelId ? { lastChannelId: who.channelId } : {}),
        status: 'waiting',
        orderKey: await backOrderKey(ctx, queue._id),
    })
    return { kind: 'ok' as const, reference }
}

export const leaveResult = v.union(
    v.object({ kind: v.literal('ok'), reference: v.number() }),
    v.object({ kind: v.literal('absent') })
)

// Leaving ends the entry whatever its state (waiting, Pinged, or Playing).
export async function leave(ctx: MutationCtx, queue: QueueDoc, who: Who) {
    const participant = await findParticipant(ctx, queue._id, who)
    if (!participant) return { kind: 'absent' as const }
    if (participant.status === 'notified') {
        await dropPendingForParticipant(ctx, queue.communityId, participant)
    }
    await ctx.db.delete('participants', participant._id)
    return { kind: 'ok' as const, reference: participant.reference }
}

export const stateResult = v.union(
    v.object({ kind: v.literal('ok') }),
    v.object({ kind: v.literal('already') })
)

export async function open(ctx: MutationCtx, queue: QueueDoc) {
    return await setState(ctx, queue, 'open')
}

export async function pause(ctx: MutationCtx, queue: QueueDoc) {
    return await setState(ctx, queue, 'paused')
}

async function setState(
    ctx: MutationCtx,
    queue: QueueDoc,
    state: 'open' | 'paused'
) {
    if (queue.state === state) return { kind: 'already' as const }
    await ctx.db.patch('queues', queue._id, { state })
    return { kind: 'ok' as const }
}

// ---- Clear and Turn operations ---------------------------------------------

// A Participant as results expose them. Never a database ID.
export const entry = v.object({
    reference: v.number(),
    username: v.string(),
    platform,
    platformUserId: v.string(),
})

export type Entry = {
    reference: number
    username: string
    platform: Platform
    platformUserId: string
}

function toEntry(participant: Doc<'participants'>): Entry {
    return {
        reference: participant.reference,
        username: participant.username,
        platform: participant.platform,
        platformUserId: participant.platformUserId,
    }
}

// ---- Queue order (ADR-0008) -------------------------------------------------

// A row's place in Queue order. Rows the backfill hasn't reached yet fall back
// to `_creationTime`, which is also what the backfill copies into the key.
function orderKeyOf(row: Doc<'participants'>) {
    return row.orderKey ?? row._creationTime
}

function byOrderKey(a: Doc<'participants'>, b: Doc<'participants'>) {
    return orderKeyOf(a) - orderKeyOf(b) || a._creationTime - b._creationTime
}

function byJoinTime(a: Doc<'participants'>, b: Doc<'participants'>) {
    return a._creationTime - b._creationTime
}

// Every Participant row of the Queue, in Queue order.
async function participantsInOrder(
    ctx: QueryCtx | MutationCtx,
    queueId: Id<'queues'>
) {
    const rows = await ctx.db
        .query('participants')
        .withIndex('byQueue', (q) => q.eq('queueId', queueId))
        .collect()
    return rows.sort(byOrderKey)
}

// The Queue: waiting Participants, front first.
async function waitingInOrder(
    ctx: QueryCtx | MutationCtx,
    queueId: Id<'queues'>
) {
    const rows = await ctx.db
        .query('participants')
        .withIndex('byQueueAndStatusAndOrderKey', (q) =>
            q.eq('queueId', queueId).eq('status', 'waiting')
        )
        .collect()
    // Rows without a key come first from the index; sort them into place.
    return rows.sort(byOrderKey)
}

// A key after every existing key, so a new joiner goes to the back.
async function backOrderKey(ctx: MutationCtx, queueId: Id<'queues'>) {
    const rows = await participantsInOrder(ctx, queueId)
    const last = rows.at(-1)
    return last ? Math.floor(orderKeyOf(last)) + 1 : 1
}

// Give every row a fresh, evenly spaced key in its current order, so there is
// room between neighbours again. Returns the rows with their new keys.
async function rebalance(ctx: MutationCtx, rows: Doc<'participants'>[]) {
    const spaced = rows.map((row, index) => ({ ...row, orderKey: index + 1 }))
    for (const row of spaced) {
        await ctx.db.patch('participants', row._id, { orderKey: row.orderKey })
    }
    return spaced
}

// A key strictly between two neighbouring keys (either may be missing), or
// null when floating point has run out of room between them.
function keyBetween(lower: number | null, upper: number | null) {
    if (lower === null && upper === null) return 1
    if (lower === null) return (upper as number) - 1
    if (upper === null) return Math.floor(lower) + 1
    const middle = lower + (upper - lower) / 2
    return middle > lower && middle < upper ? middle : null
}

export const clearResult = v.union(
    v.object({ kind: v.literal('ok'), cleared: v.number() }),
    v.object({ kind: v.literal('empty') })
)

export async function clear(ctx: MutationCtx, queue: QueueDoc) {
    const waiting = await waitingInOrder(ctx, queue._id)
    if (waiting.length === 0) return { kind: 'empty' as const }
    for (const row of waiting) {
        await ctx.db.delete('participants', row._id)
    }
    return { kind: 'ok' as const, cleared: waiting.length }
}

async function logTurn(
    ctx: MutationCtx,
    participant: Doc<'participants'>,
    event: 'pinged' | 'returned_to_queue' | 'finished'
) {
    await ctx.db.insert('activityLog', {
        queueId: participant.queueId,
        username: participant.username,
        platform: participant.platform,
        platformUserId: participant.platformUserId,
        event,
    })
}

export const pingResult = v.union(
    v.object({ kind: v.literal('ok'), pinged: v.array(entry) }),
    v.object({ kind: v.literal('empty') }),
    v.object({ kind: v.literal('note_too_long'), max: v.number() })
)

// The note a Ping carries: the typed note, else the Saved ping note.
async function pingNote(
    ctx: MutationCtx,
    queue: QueueDoc,
    typed: string | null
) {
    if (typed !== null) return typed
    const community = await ctx.db.get('communities', queue.communityId)
    return community?.savedPingNote ?? null
}

// Calls one waiting Participant: Pinged, logged, and announced.
async function call(
    ctx: MutationCtx,
    queue: QueueDoc,
    participant: Doc<'participants'>,
    note: string | null
) {
    await ctx.db.patch('participants', participant._id, { status: 'notified' })
    await logTurn(ctx, participant, 'pinged')
    await announcePinged(ctx, queue.communityId, participant, note)
}

// Pings the front `count` waiting Participants (at least one). A typed note
// replaces the Community's Saved ping note for this Ping.
export async function ping(
    ctx: MutationCtx,
    queue: QueueDoc,
    count: number,
    typedNote?: string
) {
    const typed = parsePingNote(typedNote ?? '')
    if (typed.kind === 'note_too_long') return typed

    const front = (await waitingInOrder(ctx, queue._id)).slice(
        0,
        Math.max(1, Math.floor(count))
    )
    if (front.length === 0) return { kind: 'empty' as const }

    const note = await pingNote(ctx, queue, typed.note)
    for (const participant of front) {
        await call(ctx, queue, participant, note)
    }
    return { kind: 'ok' as const, pinged: front.map(toEntry) }
}

const turnState = v.union(
    v.literal('waiting'),
    v.literal('pinged'),
    v.literal('playing')
)

export const turnResult = v.union(
    v.object({ kind: v.literal('ok'), participant: entry }),
    v.object({ kind: v.literal('unknown_reference') }),
    v.object({ kind: v.literal('wrong_state'), status: turnState })
)

type TurnState = 'waiting' | 'pinged' | 'playing'

function turnStateOf(participant: Doc<'participants'>): TurnState | null {
    switch (participant.status) {
        case 'waiting':
            return 'waiting'
        case 'notified':
            return 'pinged'
        case 'playing':
            return 'playing'
        case 'done':
            return null
    }
}

async function findByReference(
    ctx: QueryCtx | MutationCtx,
    queueId: Id<'queues'>,
    reference: number
) {
    return await ctx.db
        .query('participants')
        .withIndex('byQueueAndReference', (q) =>
            q.eq('queueId', queueId).eq('reference', reference)
        )
        .first()
}

async function turn(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number,
    from: TurnState,
    apply: (participant: Doc<'participants'>) => Promise<void>
) {
    const participant = await findByReference(ctx, queue._id, reference)
    const state = participant ? turnStateOf(participant) : null
    if (!participant || !state) return { kind: 'unknown_reference' as const }
    if (state !== from) return { kind: 'wrong_state' as const, status: state }

    await apply(participant)
    return { kind: 'ok' as const, participant: toEntry(participant) }
}

export const targetedPingResult = v.union(
    turnResult,
    v.object({ kind: v.literal('note_too_long'), max: v.number() })
)

// A targeted Ping (ADR-0007): calls one waiting Participant wherever they are
// in the Queue. Otherwise the same as Ping.
export async function pingOne(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number,
    typedNote?: string
) {
    const typed = parsePingNote(typedNote ?? '')
    if (typed.kind === 'note_too_long') return typed

    return await turn(ctx, queue, reference, 'waiting', async (participant) => {
        const note = await pingNote(ctx, queue, typed.note)
        await call(ctx, queue, participant, note)
    })
}

// Pinged → Playing.
export async function play(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number
) {
    return await turn(ctx, queue, reference, 'pinged', async (participant) => {
        await ctx.db.patch('participants', participant._id, {
            status: 'playing',
        })
        await dropPendingForParticipant(ctx, queue.communityId, participant)
    })
}

// Pinged → back in the Queue, same reference. Their order key is kept, so
// they return to the place they held, including any earlier Move.
export async function returnToQueue(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number
) {
    return await turn(ctx, queue, reference, 'pinged', async (participant) => {
        await ctx.db.patch('participants', participant._id, {
            status: 'waiting',
        })
        await logTurn(ctx, participant, 'returned_to_queue')
        await dropPendingForParticipant(ctx, queue.communityId, participant)
    })
}

// Playing → finished. The entry ends; its reference is never handed out again.
export async function done(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number
) {
    return await turn(ctx, queue, reference, 'playing', async (participant) => {
        await logTurn(ctx, participant, 'finished')
        await ctx.db.delete('participants', participant._id)
    })
}

// ---- Move -------------------------------------------------------------------

// Where a Move puts the Participant. The dashboard asks relative to what the
// Admin saw (after a neighbour, or the front); chat asks for a Position. A
// Position past the end means the back.
export const moveDestination = v.union(
    v.object({ after: v.number() }),
    v.object({ toFront: v.literal(true) }),
    v.object({ position: v.number() })
)

export type MoveDestination =
    | { after: number }
    | { toFront: true }
    | { position: number }

export const moveResult = v.union(
    v.object({
        kind: v.literal('ok'),
        participant: entry,
        // The Participant's new Position in the Queue.
        position: v.number(),
    }),
    v.object({ kind: v.literal('unknown_reference') }),
    v.object({ kind: v.literal('wrong_state'), status: turnState })
)

// Moves a waiting Participant, Open or Paused. The destination is resolved to
// two neighbours in Queue order and the Participant gets a key between them,
// so only their row is written (unless the gap has run out and every row is
// rebalanced).
export async function move(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number,
    to: MoveDestination
) {
    const target = await findByReference(ctx, queue._id, reference)
    const state = target ? turnStateOf(target) : null
    if (!target || !state) return { kind: 'unknown_reference' as const }
    if (state !== 'waiting') {
        return { kind: 'wrong_state' as const, status: state }
    }

    // Everyone else in Queue order, every state: a Pinged Participant keeps
    // their place for when they come Back, so the Move goes around it.
    let others = (await participantsInOrder(ctx, queue._id)).filter(
        (row) => row._id !== target._id
    )
    const slot = insertionIndex(others, target, to)
    const keyAtSlot = () => {
        const above = others[slot - 1]
        const below = others[slot]
        return keyBetween(
            above ? orderKeyOf(above) : null,
            below ? orderKeyOf(below) : null
        )
    }
    let key = keyAtSlot()
    if (key === null) {
        others = await rebalance(ctx, others)
        key = keyAtSlot() as number
    }
    await ctx.db.patch('participants', target._id, { orderKey: key })

    const waitingAhead = others
        .slice(0, slot)
        .filter((row) => row.status === 'waiting').length
    return {
        kind: 'ok' as const,
        participant: toEntry(target),
        position: waitingAhead + 1,
    }
}

// The index in `others` (Queue order, without the target) that the target is
// inserted before.
function insertionIndex(
    others: Doc<'participants'>[],
    target: Doc<'participants'>,
    to: MoveDestination
) {
    const waitingIndexes = others.flatMap((row, index) =>
        row.status === 'waiting' ? [index] : []
    )
    const beforeWaiting = (position: number) =>
        waitingIndexes[position - 1] ?? others.length

    if ('toFront' in to) return beforeWaiting(1)
    if ('position' in to) {
        return beforeWaiting(Math.max(1, Math.floor(to.position)))
    }
    // After themselves: stay where they are.
    if (to.after === target.reference) {
        return others.filter((row) => byOrderKey(row, target) < 0).length
    }
    // A neighbour who is still here, waiting or not: directly after their
    // place in Queue order.
    const neighbour = others.findIndex((row) => row.reference === to.after)
    if (neighbour !== -1) return neighbour + 1

    // The neighbour has left. With no key to go by, land after whoever joined
    // just before them (references are handed out in join order), or at the
    // front if nobody did.
    let joinedBefore: Doc<'participants'> | null = null
    for (const row of others) {
        if (
            row.reference < to.after &&
            (!joinedBefore || row.reference > joinedBefore.reference)
        ) {
            joinedBefore = row
        }
    }
    return joinedBefore ? others.indexOf(joinedBefore) + 1 : beforeWaiting(1)
}

export const removeResult = v.union(
    v.object({ kind: v.literal('ok'), participant: entry }),
    v.object({ kind: v.literal('unknown_reference') })
)

// An Admin ends one entry, whatever its state (waiting, Pinged, or Playing).
// Silent: no Activity log entry and no Announcement. Like leaving, it drops
// any Announcement still owed to a Pinged Participant.
export async function remove(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number
) {
    const participant = await ctx.db
        .query('participants')
        .withIndex('byQueueAndReference', (q) =>
            q.eq('queueId', queue._id).eq('reference', reference)
        )
        .first()
    if (!participant || !turnStateOf(participant)) {
        return { kind: 'unknown_reference' as const }
    }
    if (participant.status === 'notified') {
        await dropPendingForParticipant(ctx, queue.communityId, participant)
    }
    await ctx.db.delete('participants', participant._id)
    return { kind: 'ok' as const, participant: toEntry(participant) }
}

// ---- Reading the Queue -----------------------------------------------------

export const positionResult = v.union(
    v.object({
        kind: v.literal('waiting'),
        position: v.number(),
        reference: v.number(),
    }),
    v.object({ kind: v.literal('pinged'), reference: v.number() }),
    v.object({ kind: v.literal('playing'), reference: v.number() }),
    v.object({ kind: v.literal('absent') })
)

export async function position(
    ctx: QueryCtx,
    queue: QueueDoc | null,
    who: Who
) {
    if (!queue) return { kind: 'absent' as const }
    const participant = await findParticipant(ctx, queue._id, who)
    const state = participant ? turnStateOf(participant) : null
    if (!participant || !state) return { kind: 'absent' as const }
    if (state !== 'waiting') {
        return { kind: state, reference: participant.reference }
    }

    const waiting = await waitingInOrder(ctx, queue._id)
    return {
        kind: 'waiting' as const,
        position: waiting.findIndex((row) => row._id === participant._id) + 1,
        reference: participant.reference,
    }
}

const viewEntry = v.object({
    reference: v.number(),
    username: v.string(),
    platform,
    platformUserId: v.string(),
    joinedAt: v.number(),
})

export const viewResult = v.object({
    kind: v.literal('ok'),
    state: v.union(v.literal('open'), v.literal('paused')),
    // The Queue: waiting Participants, front first.
    waiting: v.array(viewEntry),
    pinged: v.array(
        v.object({
            ...viewEntry.fields,
            // Set while the Announcement calling them has not been posted.
            announcementPendingSince: v.optional(v.number()),
        })
    ),
    playing: v.array(viewEntry),
})

export async function view(ctx: QueryCtx, queue: QueueDoc | null) {
    if (!queue) {
        return {
            kind: 'ok' as const,
            state: 'paused' as const,
            waiting: [],
            pinged: [],
            playing: [],
        }
    }
    // The Queue is in Queue order; Pinged and Playing stay in join order, so
    // their Slots don't shift when someone is moved.
    const rows = await participantsInOrder(ctx, queue._id)
    const list = (status: Doc<'participants'>['status']) =>
        rows
            .filter((row) => row.status === status)
            .sort(status === 'waiting' ? byOrderKey : byJoinTime)
            .map((row) => ({ ...toEntry(row), joinedAt: row._creationTime }))
    const pendingSince = await pendingSinceByReference(ctx, queue.communityId)
    return {
        kind: 'ok' as const,
        state: queue.state,
        waiting: list('waiting'),
        pinged: list('notified').map((entry) => ({
            ...entry,
            announcementPendingSince: pendingSince.get(entry.reference),
        })),
        playing: list('playing'),
    }
}
