import { formatReference } from '@nxt/backend/reference'

export type Platform = 'discord' | 'twitch' | 'youtube'

const PLATFORM_LABELS: Record<Platform, string> = {
    discord: 'Discord',
    twitch: 'Twitch',
    youtube: 'YouTube',
}

export function platformLabel(platform: Platform): string {
    return PLATFORM_LABELS[platform]
}

// `q-42 ada (Twitch)`: how Discord replies name a Participant.
export function describeParticipant(entry: {
    reference: number
    username: string
    platform: Platform
}): string {
    return `${formatReference(entry.reference)} ${entry.username} (${platformLabel(entry.platform)})`
}
