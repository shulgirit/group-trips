/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as expenses from "../expenses.js";
import type * as families from "../families.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_notices from "../lib/notices.js";
import type * as lib_validators from "../lib/validators.js";
import type * as locations from "../locations.js";
import type * as memberships from "../memberships.js";
import type * as photos from "../photos.js";
import type * as places from "../places.js";
import type * as polls from "../polls.js";
import type * as purge from "../purge.js";
import type * as push from "../push.js";
import type * as pushSend from "../pushSend.js";
import type * as rates from "../rates.js";
import type * as trips from "../trips.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  crons: typeof crons;
  documents: typeof documents;
  email: typeof email;
  events: typeof events;
  expenses: typeof expenses;
  families: typeof families;
  http: typeof http;
  invites: typeof invites;
  "lib/authz": typeof lib_authz;
  "lib/functions": typeof lib_functions;
  "lib/limits": typeof lib_limits;
  "lib/notices": typeof lib_notices;
  "lib/validators": typeof lib_validators;
  locations: typeof locations;
  memberships: typeof memberships;
  photos: typeof photos;
  places: typeof places;
  polls: typeof polls;
  purge: typeof purge;
  push: typeof push;
  pushSend: typeof pushSend;
  rates: typeof rates;
  trips: typeof trips;
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

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
