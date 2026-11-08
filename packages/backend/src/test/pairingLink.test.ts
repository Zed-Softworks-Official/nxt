import { expect, test } from 'vitest'

import { pairingLink, readPairingLink } from '../pairingLink'

test('a pairing link carries the code and the device name', () => {
    expect(
        pairingLink('https://nxtbot.app', { code: 'ABCD2345', name: 'My Deck' })
    ).toBe('https://nxtbot.app/pair?code=ABCD2345&name=My+Deck')
})

test('a pairing link without a device name carries only the code', () => {
    expect(pairingLink('https://nxtbot.app/', { code: 'ABCD2345' })).toBe(
        'https://nxtbot.app/pair?code=ABCD2345'
    )
})

test('reading a pairing link pre-fills the code and the deck name', () => {
    expect(
        readPairingLink({ code: 'ABCD2345', name: 'Stream Deck XL' })
    ).toEqual({ code: 'ABCD2345', name: 'Stream Deck XL' })
})

test('a code read from the link is upper-cased and stripped of separators', () => {
    expect(readPairingLink({ code: ' abcd-2345 ' }).code).toBe('ABCD2345')
})

test('missing or repeated params read as their first value or empty', () => {
    expect(readPairingLink({})).toEqual({ code: '', name: '' })
    expect(readPairingLink({ code: ['WXYZ6789', 'ABCD2345'] }).code).toBe(
        'WXYZ6789'
    )
})

test('a device name longer than a deck name may be is cut to fit', () => {
    const name = readPairingLink({ name: 'x'.repeat(100) }).name
    expect(name).toBe('x'.repeat(64))
})
