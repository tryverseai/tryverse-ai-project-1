/**
 * Convex Auth Password provider fork: signup still sends verification OTP exactly once via
 * the verify provider; subsequent password sign-ins for unverified accounts do NOT resend OTP
 * (@convex-dev/auth default would call `signInViaProvider(verify)` on every sign-in).
 */
import {
  ConvexCredentials,
  type ConvexCredentialsUserConfig,
} from "@convex-dev/auth/providers/ConvexCredentials";
import {
  type EmailConfig,
  type GenericActionCtxWithAuthConfig,
  type GenericDoc,
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type { DocumentByName, GenericDataModel, WithoutSystemFields } from "convex/server";
import type { Value } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";

export interface TryVersePasswordConfig<DataModel extends GenericDataModel> {
  id?: string;
  profile?: (
    params: Record<string, Value | undefined>,
    ctx: GenericActionCtxWithAuthConfig<DataModel>,
  ) => WithoutSystemFields<DocumentByName<DataModel, "users">> & {
    email: string;
  };
  validatePasswordRequirements?: (password: string) => void;
  crypto?: ConvexCredentialsUserConfig["crypto"];
  reset?: EmailConfig | ((...args: unknown[]) => EmailConfig);
  verify?: EmailConfig | ((...args: unknown[]) => EmailConfig);
}

export function TryVersePassword<DataModel extends GenericDataModel>(
  config: TryVersePasswordConfig<DataModel> = {},
) {
  const provider = config.id ?? "password";
  return ConvexCredentials<DataModel>({
    id: "password",
    authorize: async (params, ctx) => {
      const flow = params.flow as string;
      const passwordToValidate =
        flow === "signUp"
          ? (params.password as string)
          : flow === "reset-verification"
            ? (params.newPassword as string)
            : null;
      if (passwordToValidate !== null) {
        if (config.validatePasswordRequirements !== undefined) {
          config.validatePasswordRequirements(passwordToValidate);
        } else {
          validateDefaultPasswordRequirements(passwordToValidate);
        }
      }
      const profile = config.profile?.(params, ctx) ?? defaultProfile(params);
      const { email } = profile;
      const secret = params.password as string;
      let account: GenericDoc<DataModel, "authAccounts">;
      let user: GenericDoc<DataModel, "users">;
      if (flow === "signUp") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signUp` flow");
        }
        const created = await createAccount(ctx, {
          provider,
          account: { id: email, secret },
          profile: profile as never,
          shouldLinkViaEmail: config.verify !== undefined,
          shouldLinkViaPhone: false,
        });
        ({ account, user } = created);
      } else if (flow === "signIn") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signIn` flow");
        }
        // Brute-force / credential-stuffing throttle — see signInAttemptThrottle.ts. Checked
        // before the actual credential verification below; throws the same generic message
        // regardless of whether `email` belongs to a real account, so throttling itself can't be
        // used to enumerate valid addresses.
        await ctx.runMutation(internal.signInAttemptThrottle.checkThrottle, { email });
        let retrieved: Awaited<ReturnType<typeof retrieveAccount>>;
        try {
          retrieved = await retrieveAccount(ctx, {
            provider,
            account: { id: email, secret },
          });
        } catch (e) {
          await ctx.runMutation(internal.signInAttemptThrottle.recordAttemptResult, {
            email,
            success: false,
          });
          throw e;
        }
        await ctx.runMutation(internal.signInAttemptThrottle.recordAttemptResult, {
          email,
          success: retrieved !== null,
        });
        if (retrieved === null) {
          throw new Error("Invalid credentials");
        }
        ({ account, user } = retrieved);
      } else if (flow === "reset") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        const { account } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.reset, {
          accountId: account._id,
          params,
        });
      } else if (flow === "reset-verification") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        if (params.newPassword === undefined) {
          throw new Error("Missing `newPassword` param for `reset-verification` flow");
        }
        const { account: resetAccount } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        const result = await signInViaProvider(ctx, config.reset, { params });
        if (result === null) {
          throw new Error("Invalid code");
        }
        const { userId, sessionId } = result;
        if (resetAccount.userId !== userId) {
          throw new Error("Invalid code");
        }
        const newSecret = params.newPassword as string;
        await modifyAccountCredentials(ctx, {
          provider,
          account: { id: email, secret: newSecret },
        });
        await invalidateSessions(ctx, { userId, except: [sessionId] });
        return { userId, sessionId };
      } else if (flow === "email-verification") {
        if (!config.verify) {
          throw new Error(`Email verification is not enabled for ${provider}`);
        }
        const { account } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.verify, {
          accountId: account._id,
          params,
        });
      } else {
        throw new Error(
          "Missing `flow` param, it must be one of " +
            '"signUp", "signIn", "reset", "reset-verification" or ' +
            '"email-verification"!',
        );
      }
      if (config.verify && !account.emailVerified) {
        if (flow === "signIn") {
          throw new Error(
            "[TRYVERSE_EMAIL_UNVERIFIED_SIGNIN] Use the verification code we sent when you signed up.",
          );
        }
        return await signInViaProvider(ctx, config.verify, {
          accountId: account._id,
          params,
        });
      }
      return { userId: user._id };
    },
    crypto: {
      async hashSecret(password: string) {
        return await new Scrypt().hash(password);
      },
      async verifySecret(password: string, hash: string) {
        return await new Scrypt().verify(hash, password);
      },
    },
    extraProviders: [config.reset, config.verify],
    ...config,
  });
}

function validateDefaultPasswordRequirements(password: string) {
  if (!password || password.length < 8) {
    throw new Error("Invalid password");
  }
}

function defaultProfile(params: Record<string, unknown>) {
  return {
    email: params.email as string,
  };
}
