import { internal } from '@nxt/backend/api'
import { pingedAnnouncementText } from '@nxt/backend/pingNote'
import { tryCatch } from '@nxt/utils'

import type { ChatSender } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'

// Posts every pending Twitch Announcement in its broadcaster's channel and
// marks each delivered. Ones the backend says to drop (their Platform Link is
// gone) are marked dropped unposted. A failed post stays pending for the next
// run, so delivery is at least once (ADR-0004).
export async function deliverPending(
    convex: QueueConvex,
    sender: Pick<ChatSender, 'say'>
): Promise<void> {
    const pending = await convex.query(internal.announcements.pending, {
        platform: 'twitch',
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
            sender.say(
                announcement.channelId,
                pingedAnnouncementText(
                    `@${participant.login ?? participant.username}`,
                    announcement.note
                )
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
