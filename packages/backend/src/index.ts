import { ConvexHttpClient } from 'convex/browser'
import type {
	FunctionReference,
	FunctionReturnType,
	OptionalRestArgs,
} from 'convex/server'

export * from 'convex/browser'

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
}

type DeployKeyClient = ConvexHttpClient & {
	setAdminAuth: (token: string) => void
}

export function trustedConvexClient(
	url: string,
	deployKey: string,
): TrustedConvexClient {
	const client = new ConvexHttpClient(url)
	;(client as DeployKeyClient).setAdminAuth(deployKey)
	return client as TrustedConvexClient
}
