// The Sub requirement (CONTEXT.md), shared by the backend, the Twitch adapter
// and the dashboard.

export const SUB_REQUIREMENTS = ['off', 'any', 'tier2', 'tier3'] as const

export type SubRequirement = (typeof SUB_REQUIREMENTS)[number]

export const SUB_REQUIREMENT_LABELS: Record<SubRequirement, string> = {
    off: 'Off',
    any: 'Any sub',
    tier2: 'Tier 2 and up',
    tier3: 'Tier 3',
}

const MINIMUM_TIER: Record<Exclude<SubRequirement, 'off'>, number> = {
    any: 1,
    tier2: 2,
    tier3: 3,
}

/** Whether someone at `tier` (0 for no sub) meets a Sub requirement. */
export function meetsSubRequirement(
    requirement: Exclude<SubRequirement, 'off'>,
    tier: number
) {
    return tier >= MINIMUM_TIER[requirement]
}
