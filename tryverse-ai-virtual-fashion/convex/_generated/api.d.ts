/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendEmailSignupVerification from "../ResendEmailSignupVerification.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as adminTrusted from "../adminTrusted.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as authSession from "../authSession.js";
import type * as backendTrusted from "../backendTrusted.js";
import type * as billing from "../billing.js";
import type * as http from "../http.js";
import type * as modelLibrary from "../modelLibrary.js";
import type * as overview from "../overview.js";
import type * as plans from "../plans.js";
import type * as products from "../products.js";
import type * as profiles from "../profiles.js";
import type * as resendEnv from "../resendEnv.js";
import type * as seed from "../seed.js";
import type * as trustedStorage from "../trustedStorage.js";
import type * as userBootstrap from "../userBootstrap.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendEmailSignupVerification: typeof ResendEmailSignupVerification;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  adminTrusted: typeof adminTrusted;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  authSession: typeof authSession;
  backendTrusted: typeof backendTrusted;
  billing: typeof billing;
  http: typeof http;
  modelLibrary: typeof modelLibrary;
  overview: typeof overview;
  plans: typeof plans;
  products: typeof products;
  profiles: typeof profiles;
  resendEnv: typeof resendEnv;
  seed: typeof seed;
  trustedStorage: typeof trustedStorage;
  userBootstrap: typeof userBootstrap;
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
