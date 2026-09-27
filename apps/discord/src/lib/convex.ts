import { ConvexHttpClient } from '@nxt/backend'
import { env } from '~/env'

export type QueueConvex = Pick<ConvexHttpClient, 'query' | 'mutation'>

let client: QueueConvex | undefined

export function getConvex(): QueueConvex {
    if (!client) {
        client = new ConvexHttpClient(env.CONVEX_URL)
    }
    return client
}
