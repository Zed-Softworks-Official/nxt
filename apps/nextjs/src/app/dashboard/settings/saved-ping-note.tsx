'use client'

import { api } from '@nxt/backend/api'
import { PING_NOTE_MAX_LENGTH } from '@nxt/backend/pingNote'
import { useMutation, useQuery } from '@nxt/backend/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'

export function SavedPingNote() {
    const saved = useQuery(api.communities.savedPingNote, {})
    if (saved === undefined) return <SavedPingNoteSkeleton />
    return <SavedPingNoteForm saved={saved} />
}

function SavedPingNoteForm(props: { saved: string | null }) {
    const [draft, setDraft] = useState(props.saved ?? '')
    const [saving, setSaving] = useState(false)
    const setSavedPingNote = useMutation(api.communities.setSavedPingNote)

    async function save() {
        setSaving(true)
        try {
            const result = await setSavedPingNote({ note: draft })
            if (result.kind === 'note_too_long') {
                toast.error(`Keep the note to ${result.max} characters.`)
                return
            }
            setDraft(result.note ?? '')
            toast.success(
                result.note ? 'Ping note saved.' : 'Ping note cleared.'
            )
        } catch {
            toast.error("Couldn't save the ping note. Try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <SavedPingNoteHeader />
            <CardContent>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void save()
                    }}
                >
                    <label
                        className="flex flex-col gap-2 text-sm"
                        htmlFor="saved-ping-note"
                    >
                        <span className="text-muted-foreground">
                            Posted publicly after "you're up!" on every Ping,
                            unless an Admin types a different note. Leave it
                            empty for no note.
                        </span>
                        <Input
                            id="saved-ping-note"
                            maxLength={PING_NOTE_MAX_LENGTH}
                            placeholder="Join VC 2"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                        />
                    </label>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                            {draft.length}/{PING_NOTE_MAX_LENGTH}
                        </span>
                        <Button type="submit" disabled={saving}>
                            Save
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

function SavedPingNoteHeader() {
    return (
        <CardHeader>
            <CardTitle>Ping note</CardTitle>
        </CardHeader>
    )
}

export function SavedPingNoteSkeleton() {
    return (
        <Card aria-busy="true">
            <SavedPingNoteHeader />
            <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="ml-auto h-9 w-16" />
            </CardContent>
        </Card>
    )
}
