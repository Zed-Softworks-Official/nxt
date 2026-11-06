import { internal } from '@nxt/backend/api'
import { pingedAnnouncementText } from '@nxt/backend/pingNote'
import { tryCatch } from '@nxt/utils'

import type { QueueConvex } from '~/lib/convex'

// A Ping note is free text, possibly written by an Admin on another platform,
// so only the Pinged Participant may ever be mentioned. `@everyone`, roles and
// other users in a note stay plain text.
export type AnnouncementMessage = {
    content: string
    allowedMentions: { parse: never[]; users: string[] }
}

// Posts a message to a Discord channel. The real one wraps discord.js; tests
// pass a fake that records posts.
export interface AnnouncementSender {
    send(channelId: string, message: AnnouncementMessage): Promise<void>
}

// Posts every pending Discord Announcement and marks each delivered. Ones the
// backend says to drop (their Platform Link is gone) are marked dropped
// unposted. A failed post stays pending for the next run, so delivery is at
// least once (ADR-0004).
export async function deliverPending(
    convex: QueueConvex,
    sender: AnnouncementSender
): Promise<void> {
    const pending = await convex.query(internal.announcements.pending, {
        platform: 'discord',
    })

    for (const announcement of pending) {
        if (announcement.action === 'drop') {
            await convex.mutation(internal.announcements.markDropped, {
                id: announcement.id,
            })
            continue
        }

        const { participant } = announcement
        const { error } = await tryCatch(
            sender.send(announcement.channelId, {
                content: pingedAnnouncementText(
                    `<@${participant.platformUserId}>`,
                    announcement.note
                ),
                allowedMentions: {
                    parse: [],
                    users: [participant.platformUserId],
                },
            })
        )
        if (error) {
            console.error('Failed to post announcement', announcement.id, error)
            continue
        }
        await convex.mutation(internal.announcements.markDelivered, {
            id: announcement.id,
        })
    }
}
