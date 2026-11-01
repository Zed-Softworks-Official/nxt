import { expect, test } from 'vitest'
import { commands } from './index'

test('the deployed commands include the Turn commands', () => {
    const names = Object.values(commands).map((command) => command.data.name)
    expect(names).toEqual(
        expect.arrayContaining(['pingq', 'playq', 'returnq', 'doneq'])
    )
})
