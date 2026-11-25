/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminReports from "../adminReports.js";
import type * as adminSettings from "../adminSettings.js";
import type * as adviser from "../adviser.js";
import type * as archive from "../archive.js";
import type * as dashboard from "../dashboard.js";
import type * as defense from "../defense.js";
import type * as drafts from "../drafts.js";
import type * as errors from "../errors.js";
import type * as imrad from "../imrad.js";
import type * as notifications from "../notifications.js";
import type * as researchCoordinator from "../researchCoordinator.js";
import type * as roster from "../roster.js";
import type * as users from "../users.js";
import type * as workspaceChat from "../workspaceChat.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminReports: typeof adminReports;
  adminSettings: typeof adminSettings;
  adviser: typeof adviser;
  archive: typeof archive;
  dashboard: typeof dashboard;
  defense: typeof defense;
  drafts: typeof drafts;
  errors: typeof errors;
  imrad: typeof imrad;
  notifications: typeof notifications;
  researchCoordinator: typeof researchCoordinator;
  roster: typeof roster;
  users: typeof users;
  workspaceChat: typeof workspaceChat;
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
