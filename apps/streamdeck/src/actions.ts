import type { DeckAction } from '~/controller'

/** The plugin's UUID (never change it once published). */
export const PLUGIN_UUID = 'dev.zedsoftworks.nxt'

/** Each manifest action, by its UUID, and the deck action it runs. */
export const actionsByUuid: Record<string, DeckAction> = {
    [`${PLUGIN_UUID}.ping`]: 'ping',
    [`${PLUGIN_UUID}.open-pause`]: 'openPause',
    [`${PLUGIN_UUID}.play`]: 'play',
    [`${PLUGIN_UUID}.return`]: 'return',
    [`${PLUGIN_UUID}.done`]: 'done',
    [`${PLUGIN_UUID}.waiting-count`]: 'waitingCount',
    [`${PLUGIN_UUID}.pinged-count`]: 'pingedCount',
}
