import { type TrustedConvexClient, trustedConvexClient } from '@nxt/backend'
import { env } from '~/env'

export type QueueConvex = TrustedConvexClient

let client: QueueConvex | undefined

export function getConvex(): QueueConvex {
    if (!client) {
        client = trustedConvexClient(env.CONVEX_URL, env.CONVEX_DEPLOY_KEY)
    }
    return client
}
