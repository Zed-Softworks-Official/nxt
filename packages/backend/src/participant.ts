import { formatReference } from './reference'

// Platform-neutral names for Participants, shared by every platform adapter
// and the dashboard.

export type Platform = 'discord' | 'twitch' | 'youtube'

const PLATFORM_LABELS: Record<Platform, string> = {
    discord: 'Discord',
    twitch: 'Twitch',
    youtube: 'YouTube',
}

export function platformLabel(platform: Platform): string {
    return PLATFORM_LABELS[platform]
}

// A Participant as the platform commands see them.
export type Participant = {
    reference: number
    username: string
    platform: Platform
}

// `q-42 ada (Twitch)`: how chat replies name a Participant.
export function describeParticipant(entry: Participant): string {
    return `${formatReference(entry.reference)} ${entry.username} (${platformLabel(entry.platform)})`
}

// Where a Participant is in their turn, as a Turn command's refusal reports.
export type TurnState = 'waiting' | 'pinged' | 'playing'

// `q-3 is playing.`: how a refused Turn command describes the Participant.
export const TURN_STATE_WORDING: Record<TurnState, string> = {
    waiting: 'is waiting in the queue',
    pinged: 'is Pinged',
    playing: 'is playing',
}
