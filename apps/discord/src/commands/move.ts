import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'

import { referenceCommand } from '~/lib/referenceCommand'

// Move by Position. A Position past the end moves them to the back.
export const moveQ = referenceCommand({
    name: 'moveq',
    description: 'Move a waiting Participant to a Position in the queue',
    addOptions: (data) => {
        data.addIntegerOption((option) =>
            option
                .setName('position')
                .setDescription('Their new Position (1 is the front)')
                .setMinValue(1)
                .setRequired(true)
        )
    },
    act: (convex, args, interaction) =>
        convex.mutation(internal.platformQueue.move, {
            ...args,
            to: { position: requestedPosition(interaction) },
        }),
    requirement: 'Only a waiting Participant can be moved.',
    succeeded: (participant, result) =>
        `Moved ${participant} to Position ${result.position}.`,
})

function requestedPosition(interaction: CommandInteraction): number {
    if (!interaction.isChatInputCommand()) return 1
    return interaction.options.getInteger('position') ?? 1
}
