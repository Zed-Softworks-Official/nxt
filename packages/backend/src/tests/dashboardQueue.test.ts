import { api } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
	createTestBackend,
	readActivityLog,
	readQueue,
	seedCommunity,
} from '../testing'

async function seed() {
	const backend = createTestBackend()
	await seedCommunity(backend, {
		ownerId: 'owner-1',
		state: 'open',
		links: [
			{ platform: 'discord', platformId: 'guild-1' },
			{ platform: 'twitch', platformId: 'broadcaster-1' },
		],
		participants: [
			{ platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
			{
				platformUserId: 't-bob',
				username: 'bob',
				status: 'waiting',
				platform: 'twitch',
			},
		],
	})
	await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })
	return backend
}

test('the owner sees their Queue with references', async () => {
	const backend = await seed()
	const owner = backend.withIdentity({ subject: 'owner-1' })

	const view = await owner.query(api.queue.view, {})

	expect(view?.state).toBe('open')
	expect(view?.waiting.map((p) => [p.reference, p.username, p.platform])).toEqual([
		[1, 'ada', 'discord'],
		[2, 'bob', 'twitch'],
	])
})

test('signed out, the dashboard view is empty', async () => {
	const backend = await seed()

	expect(await backend.query(api.queue.view, {})).toBeNull()
	expect(await backend.query(api.queue.getActivityLog, {})).toEqual([])
})

test('the owner runs Turn commands by reference on any platform', async () => {
	const backend = await seed()
	const owner = backend.withIdentity({ subject: 'owner-1' })

	expect(await owner.mutation(api.queue.ping, { count: 2 })).toMatchObject({
		kind: 'ok',
	})
	expect(
		await owner.mutation(api.queue.play, { reference: 2 }),
	).toMatchObject({ kind: 'ok', participant: { username: 'bob' } })
	expect(
		await owner.mutation(api.queue.returnToQueue, { reference: 1 }),
	).toMatchObject({ kind: 'ok' })
	expect(await owner.mutation(api.queue.done, { reference: 2 })).toMatchObject(
		{ kind: 'ok' },
	)
	expect(await owner.mutation(api.queue.pause, {})).toEqual({ kind: 'ok' })

	expect(await readQueue(backend, 'owner-1')).toEqual({
		state: 'paused',
		participants: [
			{
				reference: 1,
				username: 'ada',
				platform: 'discord',
				platformUserId: 'd-ada',
				status: 'waiting',
			},
		],
	})
	expect(
		(await owner.query(api.queue.getActivityLog, {})).map((e) => [
			e.event,
			e.username,
		]),
	).toEqual([
		['finished', 'bob'],
		['returned_to_queue', 'ada'],
		['pinged', 'bob'],
		['pinged', 'ada'],
	])
})

test('another owner cannot touch this Queue', async () => {
	const backend = await seed()
	const other = backend.withIdentity({ subject: 'owner-2' })

	expect(await other.mutation(api.queue.ping, { count: 2 })).toEqual({
		kind: 'empty',
	})
	expect(await other.mutation(api.queue.clear, {})).toEqual({ kind: 'empty' })
	expect((await readQueue(backend, 'owner-1'))?.participants).toHaveLength(2)
	expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('signed-out Turn commands are rejected', async () => {
	const backend = await seed()

	await expect(
		backend.mutation(api.queue.ping, { count: 1 }),
	).rejects.toThrow('Not signed in')
	await expect(backend.mutation(api.queue.open, {})).rejects.toThrow(
		'Not signed in',
	)
	expect((await readQueue(backend, 'owner-1'))?.participants).toHaveLength(2)
})
