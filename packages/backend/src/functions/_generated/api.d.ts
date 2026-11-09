/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as announcements from '../announcements.js'
import type * as commandChannel from '../commandChannel.js'
import type * as communities from '../communities.js'
import type * as crons from '../crons.js'
import type * as deck from '../deck.js'
import type * as discordGuild from '../discordGuild.js'
import type * as http from '../http.js'
import type * as linkStates from '../linkStates.js'
import type * as pairedDecks from '../pairedDecks.js'
import type * as platformLinks from '../platformLinks.js'
import type * as platformQueue from '../platformQueue.js'
import type * as queue from '../queue.js'
import type * as subRequirement from '../subRequirement.js'
import type * as twitchChannels from '../twitchChannels.js'
import type * as twitchLink from '../twitchLink.js'

import type {
    ApiFromModules,
    FilterApi,
    FunctionReference,
} from 'convex/server'

declare const fullApi: ApiFromModules<{
    announcements: typeof announcements
    commandChannel: typeof commandChannel
    communities: typeof communities
    crons: typeof crons
    deck: typeof deck
    discordGuild: typeof discordGuild
    http: typeof http
    linkStates: typeof linkStates
    pairedDecks: typeof pairedDecks
    platformLinks: typeof platformLinks
    platformQueue: typeof platformQueue
    queue: typeof queue
    subRequirement: typeof subRequirement
    twitchChannels: typeof twitchChannels
    twitchLink: typeof twitchLink
}>

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
    typeof fullApi,
    FunctionReference<any, 'public'>
>

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
    typeof fullApi,
    FunctionReference<any, 'internal'>
>

export declare const components: {}
