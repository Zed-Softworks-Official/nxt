import { expect, test } from 'vitest'

import { formatReference, parseReference } from '../reference'

test('references read as q-<number>', () => {
	expect(formatReference(42)).toBe('q-42')
})

test('Admins may type a reference with or without the q- prefix', () => {
	expect(parseReference('q-42')).toBe(42)
	expect(parseReference(' Q-7 ')).toBe(7)
	expect(parseReference('42')).toBe(42)
})

test('anything else is not a reference', () => {
	for (const text of ['', 'q-', 'q-0', 'q-1.5', 'q42x', '@ada', '-3', 'q--3']) {
		expect(parseReference(text)).toBeNull()
	}
})
