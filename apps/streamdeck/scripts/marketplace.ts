// Writes the Maker Console listing images into `marketplace/`: the app icon,
// the thumbnail and three gallery images (Elgato wants 1920×960 PNGs for the
// thumbnail and gallery, and at least 3 gallery items). Run `pnpm images`
// first so the key images are current; this reuses them.
// Needs `rsvg-convert` (librsvg) on the PATH, and the Geist font for the text.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { appIcon, black, mark, pink } from './brand'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const actions = path.join(
    root,
    'dev.zedsoftworks.nxtbot.sdPlugin',
    'imgs',
    'actions'
)
const out = path.join(root, 'marketplace')
const scratch = mkdtempSync(path.join(tmpdir(), 'nxt-marketplace-'))

const W = 1920
const H = 960
const font = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const muted = '#a1a1aa'

// A committed key image, placed as a rounded Stream Deck key at x,y.
function key(folder: string, x: number, y: number, size: number) {
    const inner = readFileSync(path.join(actions, folder, 'key.svg'), 'utf8')
        .trim()
        .replace(/ (width|height)="\d+"/g, '')
        .replace(
            '<svg ',
            `<svg x="${x}" y="${y}" width="${size}" height="${size}" `
        )
    const r = size * 0.14
    const id = `clip-${folder}-${x}-${y}`
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}"/></clipPath><g clip-path="url(#${id})">${inner}</g><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="none" stroke="#3f3f46" stroke-width="2"/>`
}

function text(
    x: number,
    y: number,
    size: number,
    content: string,
    { weight = 400, fill = '#ffffff', anchor = 'start' } = {}
) {
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${content}</text>`
}

function canvas(body: string) {
    // A soft pink glow keeps the black backgrounds from reading as empty.
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="glow" cx="0.85" cy="0.1" r="0.9"><stop offset="0" stop-color="${pink}" stop-opacity="0.22"/><stop offset="1" stop-color="${pink}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${black}"/><rect width="${W}" height="${H}" fill="url(#glow)"/>${body}</svg>\n`
}

// The app icon as a key: a rounded black tile with a hairline border.
function iconTile(x: number, y: number, size: number) {
    const g = size * 0.6
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.2}" fill="${black}" stroke="#27272a" stroke-width="3"/>${mark(x + (size - g) / 2, y + (size - g) / 2, g)}`
}

const thumbnail = canvas(
    iconTile(200, 230, 500) +
        text(800, 440, 150, 'nxtbot', { weight: 800 }) +
        text(806, 530, 54, 'for Stream Deck', { weight: 500, fill: pink }) +
        text(806, 640, 40, 'Run your Queue without leaving the stream.', {
            fill: muted,
        })
)

// Every action on one deck.
const deckKeys = [
    'ping',
    'open-pause',
    'play',
    'return',
    'done',
    'waiting-count',
    'pinged-count',
]
const keySize = 190
const gap = 46
const rowWidth = deckKeys.length * keySize + (deckKeys.length - 1) * gap
const rowX = (W - rowWidth) / 2
const gallery1 = canvas(
    text(W / 2, 200, 84, 'Every Queue action, one press away', {
        weight: 700,
        anchor: 'middle',
    }) +
        text(
            W / 2,
            270,
            38,
            'Seven keys that stay in sync with your dashboard, live.',
            {
                fill: muted,
                anchor: 'middle',
            }
        ) +
        `<rect x="${rowX - 60}" y="420" width="${rowWidth + 120}" height="${keySize + 120}" rx="48" fill="#0a0a0a" stroke="#27272a" stroke-width="3"/>` +
        deckKeys
            .map((folder, i) =>
                key(folder, rowX + i * (keySize + gap), 480, keySize)
            )
            .join('')
)

// The turn loop: Ping, Play, Done.
const steps: [string, string][] = [
    ['ping', 'Call the next people up'],
    ['play', 'Move them to Playing'],
    ['done', 'Finish their turn'],
]
const stepKey = 280
const stepGap = 260
const stepsX = (W - (3 * stepKey + 2 * stepGap)) / 2
const arrow = (x: number, y: number) =>
    `<path d="M${x} ${y}h150m-36 -36l36 36-36 36" fill="none" stroke="${pink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
const gallery2 = canvas(
    text(W / 2, 200, 84, 'Ping. Play. Done.', {
        weight: 700,
        anchor: 'middle',
    }) +
        text(W / 2, 270, 38, 'A whole turn in three presses.', {
            fill: muted,
            anchor: 'middle',
        }) +
        steps
            .map(([folder, caption], i) => {
                const x = stepsX + i * (stepKey + stepGap)
                const cx = x + stepKey / 2
                return (
                    key(folder, x, 380, stepKey) +
                    text(cx, 740, 38, caption, {
                        weight: 500,
                        fill: muted,
                        anchor: 'middle',
                    }) +
                    (i < 2 ? arrow(x + stepKey + 55, 380 + stepKey / 2) : '')
                )
            })
            .join('')
)

// Pairing: three numbered steps.
const pairing: [string, string][] = [
    ['Drag an nxtbot key onto your deck', 'Its settings show a pairing code.'],
    [
        'Approve the code on nxtbot.app',
        'One click from the button in the key’s settings.',
    ],
    ['Run your Queue', 'One pairing covers every key and every device.'],
]
const gallery3 = canvas(
    iconTile(1300, 300, 400) +
        text(200, 220, 84, 'Pair once, you’re live', { weight: 700 }) +
        pairing
            .map(([title, caption], i) => {
                const y = 360 + i * 180
                return (
                    `<circle cx="240" cy="${y}" r="40" fill="${pink}"/>` +
                    text(240, y + 15, 42, String(i + 1), {
                        weight: 700,
                        fill: black,
                        anchor: 'middle',
                    }) +
                    text(320, y + 2, 46, title, { weight: 600 }) +
                    text(320, y + 56, 32, caption, { fill: muted })
                )
            })
            .join('')
)

const images: [name: string, svg: string, width: number, height: number][] = [
    ['icon.png', appIcon(1024), 1024, 1024],
    ['thumbnail.png', thumbnail, W, H],
    ['gallery-1-keys.png', gallery1, W, H],
    ['gallery-2-turn.png', gallery2, W, H],
    ['gallery-3-pairing.png', gallery3, W, H],
]

mkdirSync(out, { recursive: true })
for (const [name, svg, width, height] of images) {
    const source = path.join(scratch, name.replace('.png', '.svg'))
    writeFileSync(source, svg)
    execFileSync('rsvg-convert', [
        '-w',
        String(width),
        '-h',
        String(height),
        '-b',
        black,
        '-o',
        path.join(out, name),
        source,
    ])
}
