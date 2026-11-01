/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as commandChannel from "../commandChannel.js";
import type * as communities from "../communities.js";
import type * as discordGuild from "../discordGuild.js";
import type * as http from "../http.js";
import type * as linkStates from "../linkStates.js";
import type * as platformLinks from "../platformLinks.js";
import type * as platformQueue from "../platformQueue.js";
import type * as queue from "../queue.js";
import type * as twitchChannels from "../twitchChannels.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  commandChannel: typeof commandChannel;
  communities: typeof communities;
  discordGuild: typeof discordGuild;
  http: typeof http;
  linkStates: typeof linkStates;
  platformLinks: typeof platformLinks;
  platformQueue: typeof platformQueue;
  queue: typeof queue;
  twitchChannels: typeof twitchChannels;
}>;

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
  FunctionReference<any, "public">
>;

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
  FunctionReference<any, "internal">
>;

export declare const components: {};
