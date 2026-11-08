// Writes the manifest's images into the .sdPlugin folder: each action's
// list icon and default key image, the category icon and the plugin icon.
// Run with `pnpm images` after changing a glyph; the output is committed.
// The PNG plugin icon needs `rsvg-convert` (librsvg) on the PATH.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { KeyIcon } from '../src/controller'
import { glyph, keyImage } from '../src/keyImage'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const imgs = path.join(root, 'dev.zedsoftworks.nxtbot.sdPlugin', 'imgs')

// Manifest image folder, glyph and default title, per action.
const actions: [folder: string, icon: KeyIcon, title: string][] = [
    ['ping', 'ping', 'Ping'],
    ['open-pause', 'open', 'Open'],
    ['play', 'play', 'Play'],
    ['return', 'return', 'Return'],
    ['done', 'done', 'Done'],
    ['waiting-count', 'waiting', 'Waiting'],
    ['pinged-count', 'pinged', 'Pinged'],
]

// The glyphs sit in the top of a 144 key; this box frames them alone.
const glyphBox = '32 8 80 80'

function monochrome(icon: KeyIcon, size: number) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${glyphBox}">${glyph(icon, '#ffffff')}</svg>\n`
}

function fromDataUrl(url: string) {
    const base64 = url.slice(url.indexOf(',') + 1)
    return `${Buffer.from(base64, 'base64').toString('utf8')}\n`
}

function write(file: string, content: string) {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, content)
}

for (const [folder, icon, title] of actions) {
    const dir = path.join(imgs, 'actions', folder)
    write(path.join(dir, 'icon.svg'), monochrome(icon, 20))
    write(
        path.join(dir, 'key.svg'),
        fromDataUrl(
            keyImage({
                connection: 'live',
                icon,
                title,
                platform: null,
                dimmed: false,
                warning: false,
            })
        )
    )
}
write(path.join(imgs, 'plugin', 'category-icon.svg'), monochrome('ping', 28))

// The plugin icon must be PNG: 256×256 and a 512×512 @2x.
const pluginIcon = path.join(
    mkdtempSync(path.join(tmpdir(), 'nxt-icon-')),
    'marketplace.svg'
)
write(
    pluginIcon,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 144 144"><rect width="144" height="144" rx="28" fill="#18181b"/><g transform="translate(0 26)">${glyph('ping', '#f59e0b')}</g></svg>\n`
)
for (const [name, size] of [
    ['marketplace.png', 256],
    ['marketplace@2x.png', 512],
] as const) {
    execFileSync('rsvg-convert', [
        '-w',
        String(size),
        '-h',
        String(size),
        '-o',
        path.join(imgs, 'plugin', name),
        pluginIcon,
    ])
}
