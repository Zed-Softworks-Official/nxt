// Ping notes, shared by the backend, every platform adapter and the dashboard.

export const PING_NOTE_MAX_LENGTH = 200

export type PingNoteResult =
    | { kind: 'ok'; note: string | null }
    | { kind: 'note_too_long'; max: number }

// Trims the note and turns line breaks into spaces, then applies the limit.
// A note that ends up blank is no note.
export function parsePingNote(raw: string): PingNoteResult {
    const note = raw.replace(/\s*[\r\n]+\s*/g, ' ').trim()
    if (note.length > PING_NOTE_MAX_LENGTH) {
        return { kind: 'note_too_long', max: PING_NOTE_MAX_LENGTH }
    }
    return { kind: 'ok', note: note === '' ? null : note }
}

// The text of a Pinged Announcement. `mention` is in the platform's own format.
export function pingedAnnouncementText(mention: string, note?: string): string {
    return note ? `${mention} you're up! ${note}` : `${mention} you're up!`
}
