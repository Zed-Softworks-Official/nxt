import { ConvexHttpClient } from '@nxt/backend'
import { env } from '~/env'

export const convex = new ConvexHttpClient(env.CONVEX_URL)
