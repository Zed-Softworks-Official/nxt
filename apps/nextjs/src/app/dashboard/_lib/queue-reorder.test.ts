import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { moveForDrop, reorderWaiting } from './queue-reorder.ts'

describe('moveForDrop', () => {
    test('dropping onto the front row moves to the front', () => {
        assert.deepEqual(moveForDrop([1, 2, 3], 3, 1), { toFront: true })
    })

    test('dragging down lands after the row dropped on', () => {
        assert.deepEqual(moveForDrop([1, 2, 3, 4], 1, 3), { after: 3 })
    })

    test('dragging up lands after the row above the one dropped on', () => {
        assert.deepEqual(moveForDrop([1, 2, 3, 4], 4, 2), { after: 1 })
    })

    test('dropping a row back on itself is not a Move', () => {
        assert.equal(moveForDrop([1, 2, 3], 2, 2), null)
    })

    test('a row that is no longer waiting is not a Move', () => {
        assert.equal(moveForDrop([1, 2, 3], 9, 2), null)
        assert.equal(moveForDrop([1, 2, 3], 2, 9), null)
    })
})

describe('reorderWaiting', () => {
    const queue = [1, 2, 3, 4].map((reference) => ({ reference }))
    const refs = (rows: { reference: number }[] | null) =>
        rows?.map((row) => row.reference) ?? null

    test('a Move to the front puts the row first', () => {
        assert.deepEqual(
            refs(reorderWaiting(queue, 3, { toFront: true })),
            [3, 1, 2, 4]
        )
    })

    test('a Move after a neighbour puts the row right below it', () => {
        assert.deepEqual(
            refs(reorderWaiting(queue, 1, { after: 3 })),
            [2, 3, 1, 4]
        )
        assert.deepEqual(
            refs(reorderWaiting(queue, 4, { after: 1 })),
            [1, 4, 2, 3]
        )
    })

    test('leaves the Queue alone when either row is not waiting', () => {
        assert.equal(reorderWaiting(queue, 9, { toFront: true }), null)
        assert.equal(reorderWaiting(queue, 2, { after: 9 }), null)
    })
})
