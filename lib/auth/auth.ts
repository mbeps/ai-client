import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/drizzle/db";
import { nextCookies } from "better-auth/next-js";
import { sendPasswordResetEmail } from "../emails/password-reset-email";
import { sendEmailVerificationEmail } from "../emails/email-verification";
import { createAuthMiddleware } from "better-auth/api";
import { sendWelcomeEmail } from "../emails/welcome-email";
import { sendDeleteAccountVerificationEmail } from "../emails/delete-account-verification";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import { env } from "@/lib/env";

/**
 * Better Auth server instance for all authentication operations. **SERVER-ONLY** — never import in client components.
 * Configured with email/password, GitHub and Discord OAuth, passkey, and two-factor authentication plugins.
 * Sessions are JWT-based encrypted HTTP-only cookies (7-day expiration, refreshed daily) via the nextCookies plugin.
 * Requires BETTER_AUTH_SECRET for HMAC signing and BETTER_AUTH_URL for callback routing.
 * Transactional emails (verification, password reset, account deletion, welcome) dispatch via Postmark.
 *
 * @see {@link https://better-auth.com/docs} for configuration options
 * @see {@link lib/auth/auth-client.ts} for client-side usage
 * @author Maruf Bepary
 */
export const auth = betterAuth({
  appName: "Better Auth Demo",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendDeleteAccountVerificationEmail({ user, url });
      },
    },
    additionalFields: {
      // Intentionally left empty for future extensibility
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ user, url });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationEmail({ user, url });
    },
  },
  socialProviders: {
    github: {
      clientId: env.CLIENT_ID_GITHUB!,
      clientSecret: env.CLIENT_SECRET_GITHUB!,
    },
    discord: {
      clientId: env.CLIENT_ID_DISCORD!,
      clientSecret: env.CLIENT_SECRET_DISCORD!,
    },
  },
  session: {
    // JWT-based stateless sessions with encrypted cookies
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh session token every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days cache duration
      strategy: "jwt", // JWT tokens for session validation
    },
  },
  plugins: [nextCookies(), twoFactor(), passkey()],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        const user = ctx.context.newSession?.user ?? {
          name: ctx.body.name,
          email: ctx.body.email,
        };

        if (user != null) {
          await sendWelcomeEmail(user);
        }
      }
    }),
  },
});
