import type { KeyAppearance, KeyIcon, Platform } from '~/controller'

// Draws a key's appearance as a 144×144 SVG data URL for `setImage`. The
// title is part of the image (the manifest turns user titles off), so one
// image carries the action glyph, the title, the platform icon and the
// warning mark. Offline and unpaired keys are grey; dimmed keys are faded.

const SIZE = 144

type Palette = { background: string; ink: string; accent: string }

const live: Palette = { background: '#18181b', ink: '#ffffff', accent: '' }
const grey: Palette = { background: '#3f3f46', ink: '#a1a1aa', accent: '' }

const accents: Record<KeyIcon, string> = {
    ping: '#f59e0b',
    open: '#22c55e',
    paused: '#ef4444',
    play: '#22c55e',
    return: '#f59e0b',
    done: '#3b82f6',
    waiting: '#a855f7',
    pinged: '#f59e0b',
}

// Each glyph sits in the top half of the key, drawn with the given colour.
const glyphs: Record<KeyIcon, (color: string) => string> = {
    ping: (c) =>
        `<path d="M72 18c-14 0-24 10-24 24v14l-8 10h64l-8-10V42c0-14-10-24-24-24z" fill="${c}"/><circle cx="72" cy="72" r="6" fill="${c}"/>`,
    pinged: (c) =>
        `<path d="M72 18c-14 0-24 10-24 24v14l-8 10h64l-8-10V42c0-14-10-24-24-24z" fill="${c}"/><circle cx="96" cy="24" r="8" fill="#ef4444"/>`,
    open: (c) =>
        `<circle cx="72" cy="44" r="26" fill="none" stroke="${c}" stroke-width="7"/><path d="M60 44l8 8 16-16" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    paused: (c) =>
        `<rect x="56" y="20" width="10" height="48" rx="3" fill="${c}"/><rect x="78" y="20" width="10" height="48" rx="3" fill="${c}"/>`,
    play: (c) => `<path d="M58 18l34 26-34 26z" fill="${c}"/>`,
    return: (c) =>
        `<path d="M90 64a24 24 0 1 0-24-38" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M52 16l16 10-14 14z" fill="${c}"/>`,
    done: (c) =>
        `<path d="M50 44l16 16 30-32" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    waiting: (c) =>
        `<circle cx="72" cy="32" r="12" fill="${c}"/><path d="M48 70c0-14 10-22 24-22s24 8 24 22z" fill="${c}"/>`,
}

const platforms: Record<Platform, { color: string; mark: string }> = {
    discord: {
        color: '#5865f2',
        mark: '<rect x="-12" y="-8" width="24" height="16" rx="6" fill="#fff"/><circle cx="-5" cy="0" r="2.5" fill="#5865f2"/><circle cx="5" cy="0" r="2.5" fill="#5865f2"/>',
    },
    twitch: {
        color: '#9146ff',
        mark: '<path d="M-10-10h20v13l-6 6h-5l-4 4v-4h-5z" fill="#fff"/><rect x="-3" y="-5" width="2.5" height="6" fill="#9146ff"/><rect x="3" y="-5" width="2.5" height="6" fill="#9146ff"/>',
    },
    youtube: {
        color: '#ff0000',
        mark: '<path d="M-4-6l10 6-10 6z" fill="#fff"/>',
    },
}

/** An action's glyph alone, in the key's 144×144 space (for manifest icons). */
export function glyph(icon: KeyIcon, color: string) {
    return glyphs[icon](color)
}

function escapeXml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function platformBadge(platform: Platform) {
    const { color, mark } = platforms[platform]
    return `<g id="platform-${platform}" transform="translate(72 124)"><circle r="14" fill="${color}"/>${mark}</g>`
}

const warningMark =
    '<g id="warning" transform="translate(120 24)"><path d="M0-18l18 32h-36z" fill="#f59e0b" stroke="#18181b" stroke-width="3"/><rect x="-2.5" y="-8" width="5" height="12" fill="#18181b"/><circle cy="9" r="3" fill="#18181b"/></g>'

export function keyImage(appearance: KeyAppearance): string {
    const isGrey = appearance.connection !== 'live'
    const palette = isGrey ? grey : live
    const accent = isGrey ? palette.ink : accents[appearance.icon]
    const fontSize = appearance.title.length > 6 ? 20 : 26
    const titleY = appearance.platform ? 98 : 108

    const body = [
        glyphs[appearance.icon](accent),
        `<text x="72" y="${titleY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${fontSize}" fill="${palette.ink}">${escapeXml(appearance.title)}</text>`,
        !isGrey && appearance.platform
            ? platformBadge(appearance.platform)
            : '',
    ].join('')

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
        `<rect${isGrey ? ' id="grey"' : ''} width="${SIZE}" height="${SIZE}" fill="${palette.background}"/>`,
        appearance.dimmed ? `<g opacity="0.35">${body}</g>` : body,
        !isGrey && appearance.warning ? warningMark : '',
        '</svg>',
    ].join('')

    return `data:image/svg+xml;base64,${toBase64(svg)}`
}

function toBase64(text: string) {
    let binary = ''
    for (const byte of new TextEncoder().encode(text)) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary)
}
