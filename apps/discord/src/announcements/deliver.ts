import { internal } from '@nxt/backend/api'
import { formatReference } from '@nxt/backend/reference'
import { tryCatch } from '@nxt/utils'

import type { QueueConvex } from '~/lib/convex'

// Posts a message to a Discord channel. The real one wraps discord.js; tests
// pass a fake that records posts.
export interface AnnouncementSender {
    send(channelId: string, content: string): Promise<void>
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
            sender.send(
                announcement.channelId,
                `<@${participant.platformUserId}> you're up! (${formatReference(participant.reference)})`
            )
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
