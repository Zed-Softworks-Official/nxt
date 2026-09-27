import {
    ChannelType,
    type CommandInteraction,
    PermissionFlagsBits,
} from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { channel } from './channel'

type ChannelKind = 'text' | 'thread' | 'announcement' | 'forum' | 'voice'

function channelType(kind: ChannelKind): ChannelType {
    switch (kind) {
        case 'text':
            return ChannelType.GuildText
        case 'thread':
            return ChannelType.PublicThread
        case 'announcement':
            return ChannelType.GuildAnnouncement
        case 'forum':
            return ChannelType.GuildForum
        case 'voice':
            return ChannelType.GuildVoice
    }
}

function fakeChannel(id: string, kind: ChannelKind) {
    return {
        id,
        type: channelType(kind),
        isThread: () => kind === 'thread',
    }
}

function channelInteraction(input: {
    guildId?: string | null
    channelId?: string
    manageServer?: boolean
    here?: ChannelKind
    argument?: { id: string; kind: ChannelKind }
    fetched?: ChannelKind
    fetchRejects?: boolean
}) {
    const channelId = input.channelId ?? 'channel-1'
    const { interaction, replies } = fakeInteraction({
        guildId: input.guildId,
        channelId,
        manageServer: input.manageServer,
    })
    const lookup = input.fetched !== undefined || input.fetchRejects === true
    const withChannel = Object.assign(interaction, {
        channel: lookup ? null : fakeChannel(channelId, input.here ?? 'text'),
        ...(lookup
            ? {
                  client: {
                      channels: {
                          fetch: async (id: string) => {
                              if (input.fetchRejects) {
                                  throw new Error('Unknown Channel')
                              }
                              return fakeChannel(id, input.fetched ?? 'text')
                          },
                      },
                  },
              }
            : {}),
        isChatInputCommand: () => true,
        options: {
            getChannel: (name: string) => {
                if (name !== 'channel' || !input.argument) return null
                return fakeChannel(input.argument.id, input.argument.kind)
            },
        },
    })

    return {
        interaction: withChannel as unknown as CommandInteraction,
        replies,
    }
}

test('channel is offered only to members with Manage Server', () => {
    expect(channel.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('channel without Manage Server replies that you need Manage Server', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'You need Manage Server to do that.',
            ephemeral: false,
        },
    ])
})

test('channel with no argument sets the text channel it was typed in', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands now go in <#111>.',
            ephemeral: false,
        },
    ])
})

test('channel with no argument fetches the text channel it was typed in when the channel cache is empty', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        fetched: 'text',
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands now go in <#111>.',
            ephemeral: false,
        },
    ])
})

test('channel typed in an uncached channel replies to pick a text channel when the lookup is rejected', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        fetchRejects: true,
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pick a text channel.', ephemeral: false },
    ])
})

test('channel typed in an uncached thread replies to pick a text channel, not a thread', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: 'thread-1',
        manageServer: true,
        fetched: 'thread',
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Pick a text channel, not a thread.',
            ephemeral: false,
        },
    ])
})

test('channel with a text channel argument sets that channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        argument: { id: '333', kind: 'text' },
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands now go in <#333>.',
            ephemeral: false,
        },
    ])
})

test('channel typed in the command channel again replies that it already goes there', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands already go in <#111>.',
            ephemeral: false,
        },
    ])
})

test('channel pointed at the channel already set replies that it already goes there', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '222',
        manageServer: true,
        argument: { id: '111', kind: 'text' },
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands already go in <#111>.',
            ephemeral: false,
        },
    ])
})

test('channel typed in a thread replies to pick a text channel, not a thread', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: 'thread-1',
        manageServer: true,
        here: 'thread',
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Pick a text channel, not a thread.',
            ephemeral: false,
        },
    ])
})

test('channel with a thread argument replies to pick a text channel, not a thread', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        argument: { id: 'thread-1', kind: 'thread' },
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Pick a text channel, not a thread.',
            ephemeral: false,
        },
    ])
})

test('channel typed in an announcement channel replies to pick a text channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: 'news-1',
        manageServer: true,
        here: 'announcement',
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pick a text channel.', ephemeral: false },
    ])
})

test('channel with a forum argument replies to pick a text channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        argument: { id: 'forum-1', kind: 'forum' },
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pick a text channel.', ephemeral: false },
    ])
})

test('channel with a voice channel argument replies to pick a text channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '111',
        manageServer: true,
        argument: { id: 'voice-1', kind: 'voice' },
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pick a text channel.', ephemeral: false },
    ])
})

test('channel runs in a channel other than the command channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
    })
    const { interaction, replies } = channelInteraction({
        guildId: 'guild-1',
        channelId: '222',
        manageServer: true,
    })

    await channel.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands now go in <#222>.',
            ephemeral: false,
        },
    ])
})
