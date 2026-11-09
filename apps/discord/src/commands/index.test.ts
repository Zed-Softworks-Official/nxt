import { expect, test } from 'vitest'
import { commands } from './index'

test('the deployed commands include the Turn commands', () => {
    const names = Object.values(commands).map((command) => command.data.name)
    expect(names).toEqual(
        expect.arrayContaining(['pingq', 'playq', 'returnq', 'doneq'])
    )
})

test('the deployed commands include Remove and Move', () => {
    const names = Object.values(commands).map((command) => command.data.name)
    expect(names).toEqual(expect.arrayContaining(['removeq', 'moveq']))
})
