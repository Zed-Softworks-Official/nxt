import {
    type TrustedConvexClient,
    type TrustedSubscriber,
    trustedConvexClient,
    trustedConvexSubscriber,
} from '@nxt/backend'
import { env } from '~/env'

export type QueueConvex = TrustedConvexClient

let client: QueueConvex | undefined

export function getConvex(): QueueConvex {
    if (!client) {
        client = trustedConvexClient(env.CONVEX_URL, env.CONVEX_DEPLOY_KEY)
    }
    return client
}

// A WebSocket client for subscriptions. Created once, on first use.
let subscriber: TrustedSubscriber | undefined

export function getConvexSubscriber(): TrustedSubscriber {
    if (!subscriber) {
        subscriber = trustedConvexSubscriber(
            env.CONVEX_URL,
            env.CONVEX_DEPLOY_KEY
        )
    }
    return subscriber
}
