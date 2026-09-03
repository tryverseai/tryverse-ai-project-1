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
import type * as authAccountCleanup from "../authAccountCleanup.js";
import type * as authSession from "../authSession.js";
import type * as authSubjectKeys from "../authSubjectKeys.js";
import type * as backendTrusted from "../backendTrusted.js";
import type * as billing from "../billing.js";
import type * as billingReconciliation from "../billingReconciliation.js";
import type * as crons from "../crons.js";
import type * as emailLayout from "../emailLayout.js";
import type * as emailVerificationThrottle from "../emailVerificationThrottle.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as migrations from "../migrations.js";
import type * as modelLibrary from "../modelLibrary.js";
import type * as modelLibrarySeedRows from "../modelLibrarySeedRows.js";
import type * as overview from "../overview.js";
import type * as plans from "../plans.js";
import type * as products from "../products.js";
import type * as profileLookup from "../profileLookup.js";
import type * as profiles from "../profiles.js";
import type * as resendEmailErrors from "../resendEmailErrors.js";
import type * as resendEnv from "../resendEnv.js";
import type * as security from "../security.js";
import type * as seed from "../seed.js";
import type * as signInAttemptThrottle from "../signInAttemptThrottle.js";
import type * as trustedStorage from "../trustedStorage.js";
import type * as tryVersePassword from "../tryVersePassword.js";
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
  authAccountCleanup: typeof authAccountCleanup;
  authSession: typeof authSession;
  authSubjectKeys: typeof authSubjectKeys;
  backendTrusted: typeof backendTrusted;
  billing: typeof billing;
  billingReconciliation: typeof billingReconciliation;
  crons: typeof crons;
  emailLayout: typeof emailLayout;
  emailVerificationThrottle: typeof emailVerificationThrottle;
  http: typeof http;
  invites: typeof invites;
  migrations: typeof migrations;
  modelLibrary: typeof modelLibrary;
  modelLibrarySeedRows: typeof modelLibrarySeedRows;
  overview: typeof overview;
  plans: typeof plans;
  products: typeof products;
  profileLookup: typeof profileLookup;
  profiles: typeof profiles;
  resendEmailErrors: typeof resendEmailErrors;
  resendEnv: typeof resendEnv;
  security: typeof security;
  seed: typeof seed;
  signInAttemptThrottle: typeof signInAttemptThrottle;
  trustedStorage: typeof trustedStorage;
  tryVersePassword: typeof tryVersePassword;
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
