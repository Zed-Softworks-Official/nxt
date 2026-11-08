'use client'

import { api } from '@nxt/backend/api'
import type { Id } from '@nxt/backend/dataModel'
import { useMutation, useQuery } from '@nxt/backend/react'

import { Keyboard } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '~/components/ui/empty'
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from '~/components/ui/item'
import { Skeleton } from '~/components/ui/skeleton'

import { useTimeAgo } from '../_lib/time-ago'

type PairedDeck = {
    id: Id<'pairedDecks'>
    name: string
    createdAt: number
    lastUsedAt: number | null
}

export function PairedDecks() {
    const decks = useQuery(api.pairedDecks.list, {})

    if (!decks) return <PairedDecksSkeleton />

    if (decks.length === 0) {
        return (
            <Empty className="border">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Keyboard />
                    </EmptyMedia>
                    <EmptyTitle>No Paired decks</EmptyTitle>
                    <EmptyDescription>
                        Add the Nxt plugin to the Stream Deck app, then open the
                        link it shows to pair your deck.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <ItemGroup>
            {decks.map((deck) => (
                <PairedDeckItem key={deck.id} deck={deck} />
            ))}
        </ItemGroup>
    )
}

function PairedDeckItem(props: { deck: PairedDeck }) {
    return (
        <Item>
            <ItemMedia variant="icon">
                <Keyboard className="size-6" />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{props.deck.name}</ItemTitle>
                <ItemDescription>
                    {props.deck.lastUsedAt === null ? (
                        'Never used'
                    ) : (
                        <LastUsed at={props.deck.lastUsedAt} />
                    )}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <RevokeDeck deck={props.deck} />
            </ItemActions>
        </Item>
    )
}

function LastUsed(props: { at: number }) {
    return <>Last used {useTimeAgo(props.at)}</>
}

function RevokeDeck(props: { deck: PairedDeck }) {
    const revoke = useMutation(api.pairedDecks.revoke)
    const [confirming, setConfirming] = useState(false)
    const [pending, setPending] = useState(false)

    async function confirm() {
        setPending(true)
        try {
            const result = await revoke({ id: props.deck.id })
            // `unknown` means it is already gone, which is what the owner wanted.
            if (result.kind === 'ok') {
                toast.success(
                    `${props.deck.name} can no longer run your Queue.`
                )
            }
        } catch {
            toast.error(`Couldn't revoke ${props.deck.name}. Try again.`)
            setConfirming(false)
        } finally {
            setPending(false)
        }
    }

    if (!confirming) {
        return (
            <Button variant="outline" onClick={() => setConfirming(true)}>
                Revoke
            </Button>
        )
    }

    return (
        <>
            <span className="text-sm text-muted-foreground">
                Revoke this deck?
            </span>
            <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
            >
                Cancel
            </Button>
            <Button
                variant="destructive"
                disabled={pending}
                onClick={() => void confirm()}
            >
                Revoke
            </Button>
        </>
    )
}

export function PairedDecksSkeleton() {
    return (
        <ItemGroup aria-busy="true">
            <Item>
                <ItemMedia>
                    <Skeleton className="size-6" />
                </ItemMedia>
                <ItemContent className="gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                </ItemContent>
                <ItemActions>
                    <Skeleton className="h-9 w-20" />
                </ItemActions>
            </Item>
        </ItemGroup>
    )
}
