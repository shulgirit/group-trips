/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as account from "../account.js";
import type * as admin from "../admin.js";
import type * as assist from "../assist.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as chatRun from "../chatRun.js";
import type * as chatTools from "../chatTools.js";
import type * as config from "../config.js";
import type * as crons from "../crons.js";
import type * as destinations from "../destinations.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as expenses from "../expenses.js";
import type * as families from "../families.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as importsRun from "../importsRun.js";
import type * as invites from "../invites.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_migrationRecords from "../lib/migrationRecords.js";
import type * as lib_notices from "../lib/notices.js";
import type * as lib_validators from "../lib/validators.js";
import type * as locations from "../locations.js";
import type * as memberships from "../memberships.js";
import type * as migration from "../migration.js";
import type * as photos from "../photos.js";
import type * as places from "../places.js";
import type * as placesAi from "../placesAi.js";
import type * as planner from "../planner.js";
import type * as plannerData from "../plannerData.js";
import type * as polls from "../polls.js";
import type * as providers from "../providers.js";
import type * as purge from "../purge.js";
import type * as push from "../push.js";
import type * as pushSend from "../pushSend.js";
import type * as rates from "../rates.js";
import type * as reports from "../reports.js";
import type * as reportsData from "../reportsData.js";
import type * as trips from "../trips.js";
import type * as uploads from "../uploads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  account: typeof account;
  admin: typeof admin;
  assist: typeof assist;
  auth: typeof auth;
  chat: typeof chat;
  chatRun: typeof chatRun;
  chatTools: typeof chatTools;
  config: typeof config;
  crons: typeof crons;
  destinations: typeof destinations;
  documents: typeof documents;
  email: typeof email;
  events: typeof events;
  expenses: typeof expenses;
  families: typeof families;
  http: typeof http;
  imports: typeof imports;
  importsRun: typeof importsRun;
  invites: typeof invites;
  "lib/authz": typeof lib_authz;
  "lib/functions": typeof lib_functions;
  "lib/limits": typeof lib_limits;
  "lib/migrationRecords": typeof lib_migrationRecords;
  "lib/notices": typeof lib_notices;
  "lib/validators": typeof lib_validators;
  locations: typeof locations;
  memberships: typeof memberships;
  migration: typeof migration;
  photos: typeof photos;
  places: typeof places;
  placesAi: typeof placesAi;
  planner: typeof planner;
  plannerData: typeof plannerData;
  polls: typeof polls;
  providers: typeof providers;
  purge: typeof purge;
  push: typeof push;
  pushSend: typeof pushSend;
  rates: typeof rates;
  reports: typeof reports;
  reportsData: typeof reportsData;
  trips: typeof trips;
  uploads: typeof uploads;
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
