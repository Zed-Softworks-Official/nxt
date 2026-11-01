// Participant references are stored as numbers and shown as `q-<number>`.

export function formatReference(reference: number): string {
	return `q-${reference}`
}

// Accepts `q-42`, `Q-42`, or `42`. Returns null for anything else.
export function parseReference(text: string): number | null {
	const match = /^(?:q-)?([1-9]\d*)$/i.exec(text.trim())
	if (!match?.[1]) return null
	const reference = Number(match[1])
	return Number.isSafeInteger(reference) ? reference : null
}
