import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
    // The Announcement outbox (ADR-0004). Written in the same mutation as the
    // Queue change; the platform's adapter posts it and marks it settled.
    announcements: defineTable({
        communityId: v.id('communities'),
        platform: v.union(
            v.literal('discord'),
            v.literal('twitch'),
            v.literal('youtube')
        ),
        // The platform space to announce in (guild ID, broadcaster ID).
        platformId: v.string(),
        participant: v.object({
            platformUserId: v.string(),
            username: v.string(),
            // The platform login to @mention, where it differs from the
            // display name (Twitch).
            login: v.optional(v.string()),
            reference: v.number(),
        }),
        // The channel the Participant last used, if the platform needs one.
        fallbackChannelId: v.optional(v.string()),
        kind: v.literal('pinged'),
        // The Ping note, fixed when the Ping happened.
        note: v.optional(v.string()),
        // Set once the Announcement is settled: posted, or dropped unposted.
        deliveredAt: v.optional(v.number()),
        dropped: v.optional(v.boolean()),
    })
        .index('byPlatformAndDeliveredAt', ['platform', 'deliveredAt'])
        .index('byDeliveredAt', ['deliveredAt'])
        .index('byCommunityAndPlatformAndPlatformIdAndDeliveredAt', [
            'communityId',
            'platform',
            'platformId',
            'deliveredAt',
        ]),
    activityLog: defineTable({
        queueId: v.id('queues'),
        username: v.string(),
        platform: v.union(
            v.literal('discord'),
            v.literal('twitch'),
            v.literal('youtube')
        ),
        platformUserId: v.string(),
        // What happened to this player
        event: v.union(
            v.literal('pinged'), // moved waiting → notified
            v.literal('returned_to_queue'), // moved notified → waiting (no-show)
            v.literal('finished') // session completed
        ),
    }).index('byQueue', ['queueId']),
    communities: defineTable({
        name: v.string(),
        ownerId: v.string(),
        // The last Participant reference handed out. Only ever increases.
        lastReference: v.optional(v.number()),
        // Used by every Ping that has no typed Ping note.
        savedPingNote: v.optional(v.string()),
    }).index('byOwner', ['ownerId']),
    // Single-use, short-lived link states minted by a Community owner when they
    // start linking a platform. See model/linkState.ts.
    linkStates: defineTable({
        communityId: v.id('communities'),
        ownerId: v.string(),
        platform: v.union(
            v.literal('discord'),
            v.literal('twitch'),
            v.literal('youtube')
        ),
        expiresAt: v.number(),
    }),
    // A Stream Deck approved to run its Community's Queue with the owner's
    // authority (ADR-0006). Only a hash of its secret is stored. The hash is
    // set when the plugin collects the secret; until then the deck is unusable.
    pairedDecks: defineTable({
        communityId: v.id('communities'),
        name: v.string(),
        secretHash: v.optional(v.string()),
        createdAt: v.number(),
        lastUsedAt: v.optional(v.number()),
        revokedAt: v.optional(v.number()),
    })
        .index('bySecretHash', ['secretHash'])
        .index('byCommunity', ['communityId']),
    // A short-lived request from the plugin to become a Paired deck. The
    // plugin holds the poll token; the owner approves the code.
    pairingRequests: defineTable({
        code: v.string(),
        pollTokenHash: v.string(),
        expiresAt: v.number(),
        status: v.union(
            v.literal('pending'),
            v.literal('approved'),
            v.literal('consumed')
        ),
        pairedDeckId: v.optional(v.id('pairedDecks')),
    })
        .index('byCode', ['code'])
        .index('byPollTokenHash', ['pollTokenHash'])
        .index('byExpiresAt', ['expiresAt']),
    platformLinks: defineTable({
        communityId: v.id('communities'),
        enabled: v.boolean(),
        platform: v.union(
            v.literal('discord'),
            v.literal('twitch'),
            v.literal('youtube')
        ),
        platformId: v.string(),
        platformName: v.string(),
        commandChannelId: v.optional(v.string()),
        // Set when the Community owner has turned this platform's Joins off.
        joinsOff: v.optional(v.boolean()),
        accessToken: v.optional(v.string()),
        refreshToken: v.optional(v.string()),
        // Twitch links only (ADR-0002). platformId is the broadcaster's user
        // ID; this holds the channel's names, the broadcaster's grant, and the
        // `channel.chat.message` EventSub subscription read as the Nxt bot
        // account. A Twitch channel has at most one row, so it belongs to at
        // most one Community.
        twitch: v.optional(
            v.object({
                login: v.string(),
                displayName: v.string(),
                grant: v.object({
                    accessToken: v.string(),
                    refreshToken: v.string(),
                    scopes: v.array(v.string()),
                    expiresAt: v.number(),
                }),
                // Absent once unlinked.
                subscriptionId: v.optional(v.string()),
                // The Sub requirement. Absent means Off.
                subRequirement: v.optional(
                    v.union(
                        v.literal('any'),
                        v.literal('tier2'),
                        v.literal('tier3')
                    )
                ),
                // Twitch refused the grant, so the channel must Reconnect.
                grantRevoked: v.optional(v.boolean()),
                // While set and in the future, one action is refreshing the
                // grant and others wait for it (ADR-0006).
                grantRefreshUntil: v.optional(v.number()),
            })
        ),
    })
        .index('byCommunity', ['communityId'])
        .index('byPlatform', ['platform', 'platformId'])
        .index('byCommunityAndPlatformAndEnabled', [
            'communityId',
            'platform',
            'enabled',
        ])
        .index('byPlatformAndEnabled', ['platform', 'enabled']),
    queues: defineTable({
        communityId: v.id('communities'),
        state: v.union(v.literal('open'), v.literal('paused')),
    }).index('byCommunity', ['communityId']),
    participants: defineTable({
        queueId: v.id('queues'),
        // Participant reference, shown as `q-<reference>`. Unique per Community.
        reference: v.number(),
        username: v.string(),
        // The platform login to @mention, where it differs from the display
        // name (Twitch). Refreshed when the Participant runs join again.
        login: v.optional(v.string()),
        platform: v.union(
            v.literal('discord'),
            v.literal('twitch'),
            v.literal('youtube')
        ),
        platformUserId: v.string(),
        // Where this Participant last ran a Queue command (a Discord channel).
        // Announcements fall back to it when the guild has no Command channel.
        lastChannelId: v.optional(v.string()),
        status: v.union(
            v.literal('waiting'),
            v.literal('notified'),
            v.literal('playing'),
            v.literal('done')
        ),
    })
        .index('byQueue', ['queueId'])
        .index('byQueueAndReference', ['queueId', 'reference'])
        .index('byQueueAndPlatformAndStatus', ['queueId', 'platform', 'status'])
        .index('byUser', ['platformUserId', 'platform', 'queueId']),
})
