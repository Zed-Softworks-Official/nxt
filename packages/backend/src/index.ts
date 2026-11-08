import { ConvexClient, ConvexHttpClient } from 'convex/browser'
import type {
    FunctionArgs,
    FunctionReference,
    FunctionReturnType,
    OptionalRestArgs,
} from 'convex/server'

export * from 'convex/browser'
export type { FunctionReturnType } from 'convex/server'

export type TrustedConvexClient = {
    query<Query extends FunctionReference<'query', 'public' | 'internal'>>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>>
    mutation<
        Mutation extends FunctionReference<'mutation', 'public' | 'internal'>,
    >(
        mutation: Mutation,
        ...args: OptionalRestArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
    action<Action extends FunctionReference<'action', 'public' | 'internal'>>(
        action: Action,
        ...args: OptionalRestArgs<Action>
    ): Promise<FunctionReturnType<Action>>
}

type DeployKeyClient = ConvexHttpClient & {
    setAdminAuth: (token: string) => void
}

export function trustedConvexClient(
    url: string,
    deployKey: string
): TrustedConvexClient {
    const client = new ConvexHttpClient(url)
    ;(client as DeployKeyClient).setAdminAuth(deployKey)
    return client as TrustedConvexClient
}

export type TrustedSubscriber = {
    onUpdate<Query extends FunctionReference<'query', 'public' | 'internal'>>(
        query: Query,
        args: FunctionArgs<Query>,
        callback: (result: FunctionReturnType<Query>) => unknown,
        onError?: (error: Error) => unknown
    ): () => void
    close(): Promise<void>
}

type DeployKeySubscriber = ConvexClient & {
    setAdminAuth: (token: string) => void
}

// A WebSocket client authenticated with the deploy key, so adapters can
// subscribe to internal queries such as the pending Announcements.
export function trustedConvexSubscriber(
    url: string,
    deployKey: string
): TrustedSubscriber {
    const client = new ConvexClient(url)
    ;(client as DeployKeySubscriber).setAdminAuth(deployKey)
    return client as unknown as TrustedSubscriber
}
