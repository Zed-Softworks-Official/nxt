'use client'

import { api } from '@nxt/backend/api'
import { useAction, useMutation, useQuery } from '@nxt/backend/react'

import { useState } from 'react'

import { DiscordIcon, TwitchIcon } from '~/components/icons/brand-icons'
import { Button } from '~/components/ui/button'
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

import { env } from '~/env'

export function Connections() {
    const platforms = useQuery(api.platformLinks.getPlatformLinks, {})
    const twitchSettings = useQuery(api.subRequirement.settings, {})

    if (!platforms) return <ConnectionsSkeleton />

    const discord = platforms.find(
        (link) => link.platform === 'discord' && link.enabled
    )
    const twitch = platforms.find(
        (link) => link.platform === 'twitch' && link.enabled
    )
    const needsReconnect = twitchSettings?.needsReconnect === true

    return (
        <ItemGroup>
            <Item>
                <ItemMedia variant="icon">
                    <DiscordIcon className="size-6 text-[#5865f2]" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>Discord</ItemTitle>
                    <ItemDescription>
                        {discord
                            ? 'Your Discord server is connected.'
                            : 'Connect your Discord account to use the bot.'}
                    </ItemDescription>
                </ItemContent>
                {!discord && (
                    <ItemActions>
                        <DiscordConnection />
                    </ItemActions>
                )}
            </Item>
            <Item>
                <ItemMedia variant="icon">
                    <TwitchIcon className="size-6 text-[#9146ff]" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>Twitch</ItemTitle>
                    <ItemDescription>
                        {twitch
                            ? `Linked to ${twitch.channelName ?? twitch.platformName}.`
                            : "Sign in as your channel's broadcaster to let your Twitch chat join the Queue."}
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    {twitch && needsReconnect && (
                        <TwitchConnection label="Reconnect" />
                    )}
                    {twitch ? <TwitchUnlink /> : <TwitchConnection />}
                </ItemActions>
            </Item>
        </ItemGroup>
    )
}

export function ConnectionsSkeleton() {
    return (
        <ItemGroup aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <Item key={i}>
                    <ItemMedia>
                        <Skeleton className="size-6" />
                    </ItemMedia>
                    <ItemContent className="gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-full max-w-72" />
                    </ItemContent>
                    <ItemActions>
                        <Skeleton className="h-9 w-20" />
                    </ItemActions>
                </Item>
            ))}
        </ItemGroup>
    )
}

function DiscordConnection() {
    const mintLinkState = useMutation(api.linkStates.mintLinkState)
    const [pending, setPending] = useState(false)

    async function connect() {
        // Open the tab synchronously so the popup blocker allows it, then point
        // it at Discord once the owner-bound state is minted.
        const tab = window.open('', '_blank')
        setPending(true)
        try {
            const state = await mintLinkState({ platform: 'discord' })

            const inviteUrl = new URL('https://discord.com/oauth2/authorize')
            inviteUrl.searchParams.set(
                'client_id',
                env.NEXT_PUBLIC_DISCORD_CLIENT_ID
            )
            inviteUrl.searchParams.set('permissions', '2048')
            inviteUrl.searchParams.set('response_type', 'code')
            inviteUrl.searchParams.set(
                'redirect_uri',
                env.NEXT_PUBLIC_DISCORD_REDIRECT_URI
            )
            inviteUrl.searchParams.set('scope', 'bot')
            inviteUrl.searchParams.set('state', state)

            if (tab) tab.location.href = inviteUrl.toString()
            else window.location.href = inviteUrl.toString()
        } catch (error) {
            tab?.close()
            throw error
        } finally {
            setPending(false)
        }
    }

    return (
        <Button disabled={pending} onClick={() => void connect()}>
            Connect
        </Button>
    )
}

export function TwitchConnection(props: { label?: string }) {
    const mintLinkState = useMutation(api.linkStates.mintLinkState)
    const [pending, setPending] = useState(false)

    async function connect() {
        setPending(true)
        try {
            const state = await mintLinkState({ platform: 'twitch' })

            // Authorization-code flow (ADR-0002). The broadcaster who signs in
            // decides the channel; `channel:bot` lets the Nxt bot account into
            // their chat, and `channel:read:subscriptions` lets Nxt check a
            // chatter's sub tier for the Sub requirement (ADR-0006). A linked
            // channel signing in again is a Reconnect, which keeps the link.
            const authorizeUrl = new URL(
                'https://id.twitch.tv/oauth2/authorize'
            )
            authorizeUrl.searchParams.set(
                'client_id',
                env.NEXT_PUBLIC_TWITCH_CLIENT_ID
            )
            authorizeUrl.searchParams.set(
                'redirect_uri',
                env.NEXT_PUBLIC_TWITCH_REDIRECT_URI
            )
            authorizeUrl.searchParams.set('response_type', 'code')
            authorizeUrl.searchParams.set(
                'scope',
                'channel:bot channel:read:subscriptions'
            )
            authorizeUrl.searchParams.set('force_verify', 'true')
            authorizeUrl.searchParams.set('state', state)

            window.location.href = authorizeUrl.toString()
        } catch (error) {
            setPending(false)
            throw error
        }
    }

    return (
        <Button disabled={pending} onClick={() => void connect()}>
            {props.label ?? 'Connect'}
        </Button>
    )
}

function TwitchUnlink() {
    const unlink = useAction(api.twitchLink.unlink)
    const [pending, setPending] = useState(false)

    async function disconnect() {
        setPending(true)
        try {
            await unlink({})
        } finally {
            setPending(false)
        }
    }

    return (
        <Button
            variant="outline"
            disabled={pending}
            onClick={() => void disconnect()}
        >
            Unlink
        </Button>
    )
}
