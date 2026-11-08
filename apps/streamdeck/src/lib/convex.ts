import { ConvexClient } from '@nxt/backend'
import type {
    FunctionArgs,
    FunctionReference,
    FunctionReturnType,
} from 'convex/server'

/** Whether the client's WebSocket is up. Same shape as `ConvexClient`'s. */
export type DeckConnectionState = { isWebSocketConnected: boolean }

/**
 * The slice of `ConvexClient` the deck controller needs. A deck calls public
 * deck functions with its secret as an argument (ADR-0006), so the client
 * carries no auth. Tests implement this over the in-memory backend.
 */
export type DeckConvex = {
    onUpdate<Query extends FunctionReference<'query', 'public'>>(
        query: Query,
        args: FunctionArgs<Query>,
        callback: (result: FunctionReturnType<Query>) => unknown,
        onError?: (error: Error) => unknown
    ): () => void
    mutation<Mutation extends FunctionReference<'mutation', 'public'>>(
        mutation: Mutation,
        args: FunctionArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
    connectionState(): DeckConnectionState
    subscribeToConnectionState(
        callback: (state: DeckConnectionState) => void
    ): () => void
}

/** A plain WebSocket client for the deck: no deploy key, no Clerk. */
export function deckConvex(url: string): DeckConvex {
    return new ConvexClient(url, { logger: false })
}
