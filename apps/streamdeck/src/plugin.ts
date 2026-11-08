import streamDeck from '@elgato/streamdeck'

import { actionsByUuid } from '~/actions'
import { config } from '~/config'
import {
    createDeckController,
    type DeckDisplay,
    systemClock,
} from '~/controller'
import { keyImage } from '~/keyImage'
import { type DeckConvex, deckConvex } from '~/lib/convex'
import { createPairingFlow, type PairingStatus } from '~/pairing'

// The thin Stream Deck SDK adapter (spec #20): SDK events go to the deck
// controller and the pairing flow; their output goes to setImage, showOk and
// showAlert, and pairing statuses to the Property Inspector. Not unit-tested;
// the logic lives in the controller, the pairing flow and the key images.
//
// The deck secret lives only in global settings and in memory. Never log it,
// and never raise the log level to "trace", which logs every message.

streamDeck.logger.setLevel('info')

type GlobalSettings = { secret?: string }

// A deck built without a Convex URL can't connect: every key stays offline.
const neverConnected: DeckConvex = {
    onUpdate: () => () => {},
    mutation: () => Promise.reject(new Error('Nxt is not configured')),
    connectionState: () => ({ isWebSocketConnected: false }),
    subscribeToConnectionState: () => () => {},
}

const configured = config.convexUrl !== ''
if (!configured) {
    streamDeck.logger.error('Built without CONVEX_URL; keys stay offline.')
}
const convex = configured ? deckConvex(config.convexUrl) : neverConnected

const display: DeckDisplay = {
    render(id, appearance) {
        const key = streamDeck.actions.getActionById(id)
        if (!key?.isKey()) return
        void key.setImage(keyImage(appearance))
    },
    feedback(id, feedback) {
        const key = streamDeck.actions.getActionById(id)
        if (!key?.isKey()) return
        void (feedback === 'ok' ? key.showOk() : key.showAlert())
    },
}

function saveSecret(secret: string | null) {
    const settings: GlobalSettings = secret === null ? {} : { secret }
    void streamDeck.settings.setGlobalSettings(settings)
}

const controller = createDeckController({
    convex,
    display,
    // Revoked or unknown: the controller already dropped the secret.
    onUnpaired() {
        saveSecret(null)
        pairing.stop()
        streamDeck.logger.info('Deck was unpaired.')
    },
})

function sendStatus(status: PairingStatus = pairing.status()) {
    void streamDeck.ui.sendToPropertyInspector({
        type: 'pairing',
        configured,
        ...status,
    })
}

const pairing = createPairingFlow({
    convex,
    clock: systemClock,
    dashboardOrigin: config.dashboardUrl,
    onChange: sendStatus,
    onSecret(secret) {
        saveSecret(secret)
        controller.setSecret(secret)
        streamDeck.logger.info('Deck paired.')
    },
})

// Pair from the Stream Deck whose key's settings are open, so the dashboard
// can pre-fill its name. One pairing covers every key and device.
function startPairing() {
    if (!configured) return sendStatus()
    pairing.start(streamDeck.ui.action?.device.name)
}

function deckActionOf(manifestId: string) {
    return actionsByUuid[manifestId]
}

streamDeck.actions.onWillAppear((ev) => {
    const action = deckActionOf(ev.action.manifestId)
    if (!action || !ev.action.isKey()) return
    controller.showKey(ev.action.id, action, ev.payload.settings)
})

streamDeck.settings.onDidReceiveSettings((ev) => {
    const action = deckActionOf(ev.action.manifestId)
    if (!action || !ev.action.isKey()) return
    controller.showKey(ev.action.id, action, ev.payload.settings)
})

streamDeck.actions.onWillDisappear((ev) => {
    controller.hideKey(ev.action.id)
})

streamDeck.actions.onKeyDown((ev) => {
    void controller.press(ev.action.id)
})

// Opening any key's settings shows the pairing state; an unpaired deck gets
// a code straight away.
streamDeck.ui.onDidAppear(() => {
    if (pairing.status().status === 'idle') startPairing()
    else sendStatus()
})

type InspectorMessage = { type?: unknown }

streamDeck.ui.onSendToPlugin((ev) => {
    const message = ev.payload as InspectorMessage
    switch (message.type) {
        case 'pairing:get':
            return sendStatus()
        case 'pairing:start':
            return startPairing()
        case 'pairing:open': {
            const status = pairing.status()
            if (status.status === 'waiting') {
                void streamDeck.system.openUrl(status.url)
            }
            return
        }
    }
})

await streamDeck.connect()

const saved = await streamDeck.settings.getGlobalSettings<GlobalSettings>()
if (typeof saved.secret === 'string' && saved.secret !== '') {
    pairing.markPaired()
    controller.setSecret(saved.secret)
}
