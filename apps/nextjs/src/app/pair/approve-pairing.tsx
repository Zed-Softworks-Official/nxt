'use client'

import { api } from '@nxt/backend/api'
import {
    MAX_DECK_NAME_LENGTH,
    normalizePairingCode,
} from '@nxt/backend/pairingLink'
import { useMutation } from '@nxt/backend/react'

import { CircleCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'

type Refusal = 'unknown' | 'expired' | 'used' | 'invalid_name' | 'failed'

const REFUSAL_MESSAGES: Record<Refusal, string> = {
    unknown:
        'No pairing request has this code. Check the code shown on your Stream Deck.',
    expired:
        'This code has expired. Your Stream Deck now shows a new one; enter that instead.',
    used: 'This code has already been used. Get a new code from your Stream Deck.',
    invalid_name: `Give the deck a name of up to ${MAX_DECK_NAME_LENGTH} characters.`,
    failed: "Couldn't approve the code. Make sure you've set up your Community, then try again.",
}

export function ApprovePairing(props: { code: string; name: string }) {
    const approvePairing = useMutation(api.pairedDecks.approvePairing)
    const [code, setCode] = useState(props.code)
    const [name, setName] = useState(props.name || 'Stream Deck')
    const [pending, setPending] = useState(false)
    const [refusal, setRefusal] = useState<Refusal | null>(null)
    const [approvedName, setApprovedName] = useState<string | null>(null)

    async function approve() {
        setPending(true)
        setRefusal(null)
        try {
            const result = await approvePairing({ code, name })
            if (result.kind === 'ok') setApprovedName(name.trim())
            else setRefusal(result.kind)
        } catch {
            setRefusal('failed')
        } finally {
            setPending(false)
        }
    }

    if (approvedName !== null) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CircleCheck className="size-5 text-chart-2" />
                        {approvedName} is paired
                    </CardTitle>
                    <CardDescription>
                        Your Stream Deck connects by itself in a few seconds.
                        You can close this page.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/connections">
                            See your Paired decks
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Pair a Stream Deck</CardTitle>
                <CardDescription>
                    Approve only a code shown on your own Stream Deck. A Paired
                    deck can run your Queue as you do.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void approve()
                    }}
                >
                    <label
                        className="flex flex-col gap-2 text-sm"
                        htmlFor="pairing-code"
                    >
                        <span className="text-muted-foreground">
                            Pairing code
                        </span>
                        <Input
                            id="pairing-code"
                            autoComplete="off"
                            className="font-mono uppercase tracking-widest"
                            placeholder="ABCD2345"
                            required
                            value={code}
                            onChange={(event) =>
                                setCode(
                                    normalizePairingCode(event.target.value)
                                )
                            }
                        />
                    </label>
                    <label
                        className="flex flex-col gap-2 text-sm"
                        htmlFor="deck-name"
                    >
                        <span className="text-muted-foreground">Deck name</span>
                        <Input
                            id="deck-name"
                            maxLength={MAX_DECK_NAME_LENGTH}
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </label>
                    {refusal && (
                        <p role="alert" className="text-sm text-destructive">
                            {REFUSAL_MESSAGES[refusal]}
                        </p>
                    )}
                    <Button
                        type="submit"
                        disabled={pending || code === '' || name.trim() === ''}
                    >
                        Approve
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
