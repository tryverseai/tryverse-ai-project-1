import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: ResendOTPPasswordReset,
      validatePasswordRequirements(password: string) {
        if (!password || password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
      },
      profile(params) {
        const email = String(params.email ?? "").trim();
        const flow = String(params.flow ?? "");
        const accountType =
          String(params.accountType ?? params.account_type ?? "business").toLowerCase() === "individual"
            ? "individual"
            : "business";
        const brandName = params.brandName != null ? String(params.brandName).trim() : "";
        const fullName = params.fullName != null ? String(params.fullName).trim() : "";
        const role = params.role != null ? String(params.role).trim() : "";
        const displayName =
          flow === "signUp"
            ? accountType === "individual"
              ? fullName || email.split("@")[0]!
              : brandName || fullName || email.split("@")[0]!
            : email.split("@")[0]!;
        const base: Record<string, string> & { email: string } = {
          email,
          name: displayName,
          account_type: accountType,
        };
        if (brandName !== "") base["brand_name"] = brandName;
        if (fullName !== "") base["full_name"] = fullName;
        if (role !== "") base["role"] = role;
        return base;
      },
    }),
  ],
});
