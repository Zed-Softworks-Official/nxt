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

// Every Participant row in join order. A returned Participant keeps their
// original spot because ordering is by when the entry was created.
async function participantsInOrder(
    ctx: QueryCtx | MutationCtx,
    queueId: Id<'queues'>
) {
    const rows = await ctx.db
        .query('participants')
        .withIndex('byQueue', (q) => q.eq('queueId', queueId))
        .collect()
    return rows.sort((a, b) => a._creationTime - b._creationTime)
}

export const clearResult = v.union(
    v.object({ kind: v.literal('ok'), cleared: v.number() }),
    v.object({ kind: v.literal('empty') })
)

export async function clear(ctx: MutationCtx, queue: QueueDoc) {
    const rows = await participantsInOrder(ctx, queue._id)
    const waiting = rows.filter((row) => row.status === 'waiting')
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

    const rows = await participantsInOrder(ctx, queue._id)
    const front = rows
        .filter((row) => row.status === 'waiting')
        .slice(0, Math.max(1, Math.floor(count)))
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

async function turn(
    ctx: MutationCtx,
    queue: QueueDoc,
    reference: number,
    from: TurnState,
    apply: (participant: Doc<'participants'>) => Promise<void>
) {
    const participant = await ctx.db
        .query('participants')
        .withIndex('byQueueAndReference', (q) =>
            q.eq('queueId', queue._id).eq('reference', reference)
        )
        .first()
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

// Pinged → back in the Queue, in their original spot, same reference.
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

    const rows = await participantsInOrder(ctx, queue._id)
    const ahead = rows.filter(
        (row) =>
            row.status === 'waiting' &&
            row._creationTime < participant._creationTime
    ).length
    return {
        kind: 'waiting' as const,
        position: ahead + 1,
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
    const rows = await participantsInOrder(ctx, queue._id)
    const list = (status: Doc<'participants'>['status']) =>
        rows
            .filter((row) => row.status === status)
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
