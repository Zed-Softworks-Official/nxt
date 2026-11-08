// The dashboard link a Stream Deck plugin shows for approving a pairing code
// (ADR-0006), shared by the plugin, which builds it, and the dashboard, which
// reads it: `/pair?code=ABCD2345&name=My%20Deck`.

export const PAIRING_PATH = '/pair'

export const MAX_DECK_NAME_LENGTH = 64

/** The approval link for a code, with the device name to pre-fill the deck name. */
export function pairingLink(
    dashboardOrigin: string,
    input: { code: string; name?: string }
): string {
    const url = new URL(PAIRING_PATH, dashboardOrigin)
    url.searchParams.set('code', input.code)
    if (input.name) url.searchParams.set('name', input.name)
    return url.toString()
}

type Param = string | string[] | undefined

/**
 * The code and deck name to pre-fill from a pairing link's params. The code
 * is upper-cased with separators dropped, so a hand-typed `abcd-2345` works;
 * the name is cut to the longest deck name allowed.
 */
export function readPairingLink(params: { code?: Param; name?: Param }): {
    code: string
    name: string
} {
    return {
        code: normalizePairingCode(first(params.code)),
        name: first(params.name).trim().slice(0, MAX_DECK_NAME_LENGTH),
    }
}

/** Upper-case a code and drop anything that can't be part of it. */
export function normalizePairingCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function first(param: Param): string {
    return (Array.isArray(param) ? param[0] : param) ?? ''
}
