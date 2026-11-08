// The plugin's brand mark: Lucide's skip-forward glyph, stroked in the
// dashboard's chart-2 pink on black. Shared by `pnpm images` (the plugin
// icon) and `pnpm marketplace` (the Marketplace listing images).

// chart-2 from apps/nextjs/src/styles/globals.css: oklch(0.656 0.241 354.308).
export const pink = '#f6339a'
export const black = '#000000'

// Lucide skip-forward, 24×24 viewBox, drawn as Lucide draws it.
const skipForward =
    '<path d="M21 4v16"/><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>'

// The glyph alone, scaled so its 24-unit box is `size` wide, top-left at x,y.
export function mark(x: number, y: number, size: number, color = pink) {
    return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${skipForward}</g>`
}

// The app icon: the mark centred on a black square, at `size` px.
export function appIcon(size: number) {
    // The glyph spans x 3–21 and y 4–20 of its box, so the box centre is the
    // glyph centre. 60% of the canvas leaves comfortable padding.
    const glyph = size * 0.6
    const offset = (size - glyph) / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${black}"/>${mark(offset, offset, glyph)}</svg>\n`
}
