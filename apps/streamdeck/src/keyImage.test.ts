import { expect, test } from 'vitest'

import type { KeyAppearance } from '~/controller'
import { keyImage } from '~/keyImage'

const live: KeyAppearance = {
    connection: 'live',
    icon: 'play',
    title: 'ada',
    platform: 'discord',
    dimmed: false,
    warning: false,
}

function svgOf(appearance: KeyAppearance) {
    const url = keyImage(appearance)
    const prefix = 'data:image/svg+xml;base64,'
    expect(url.startsWith(prefix)).toBe(true)
    const bytes = Uint8Array.from(atob(url.slice(prefix.length)), (c) =>
        c.charCodeAt(0)
    )
    return new TextDecoder().decode(bytes)
}

test('a slot key shows the name and the platform icon', () => {
    const svg = svgOf(live)

    expect(svg).toContain('>ada</text>')
    expect(svg).toContain('id="platform-discord"')
    expect(svg).not.toContain('id="warning"')
})

test('a Twitch participant gets the Twitch icon', () => {
    const svg = svgOf({ ...live, platform: 'twitch' })

    expect(svg).toContain('id="platform-twitch"')
    expect(svg).not.toContain('id="platform-discord"')
})

test('non-ASCII names survive the encoding', () => {
    expect(svgOf({ ...live, title: 'Zoë…' })).toContain('>Zoë…</text>')
})

test('names are escaped so they cannot break the image', () => {
    const svg = svgOf({ ...live, title: '<b>&"x' })

    expect(svg).toContain('>&lt;b&gt;&amp;&quot;x</text>')
})

test('a Failed Announcement shows a warning mark', () => {
    expect(svgOf({ ...live, warning: true })).toContain('id="warning"')
})

test('a dimmed key is drawn faded, an undimmed one is not', () => {
    expect(svgOf({ ...live, dimmed: true })).toContain('opacity="0.35"')
    expect(svgOf(live)).not.toContain('opacity="0.35"')
})

test('an offline key is grey and says offline', () => {
    const svg = svgOf({
        connection: 'offline',
        icon: 'ping',
        title: 'offline',
        platform: null,
        dimmed: true,
        warning: false,
    })

    expect(svg).toContain('>offline</text>')
    expect(svg).toContain('id="grey"')
    expect(svg).not.toContain('id="platform-')
})

test('a live key is not grey', () => {
    expect(svgOf(live)).not.toContain('id="grey"')
})

test('the same appearance always draws the same image', () => {
    expect(keyImage(live)).toBe(keyImage({ ...live }))
})
