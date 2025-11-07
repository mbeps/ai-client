# **Better Auth Crash Course**

A full-featured authentication demo built with Next.js, React, and Better Auth. 
It showcases email/password onboarding, GitHub and Discord OAuth, WebAuthn passkeys, TOTP MFA, organization management, and admin governance backed by Postgres plus Drizzle ORM. 
Transactional emails run through Postmark so you can trace every step from invitation to account deletion.

# Features

## Email & Password Auth
- Sign-up enforces email verification, handles password resets, and captures custom profile data.
- Email changes require confirmation, and password updates can optionally revoke other sessions.
- Forms stay consistent thanks to shared validation and toast feedback.

## Social OAuth
- GitHub and Discord logins provide quick onboarding and automatically map profile data.
- Users can link or unlink providers to reuse social accounts across sessions.
- OAuth buttons share a familiar look with provider icons for clarity.

## Passkeys
- Silent WebAuthn attempts sign users in automatically, with manual prompts as a fallback.
- Passkey management lets users add or delete secure passwordless credentials at any time.
- Passkeys integrate with the rest of the auth stack so sign-in states stay in sync.

## Two-Factor Authentication
- TOTP enrollment walks users through QR codes, password confirmation, and backup codes.
- Challenges support both authenticator apps and one-time backup codes.
- Redirect flows ensure two-factor prompts only appear when the session truly needs them.

## Session Management
- Dashboards list every active session, highlight the current device, and allow one-click revocation.
- Admins can revoke any user session, while end users can prune their own.
- Cookie caching keeps session reads fast even during rapid navigation.

## Account Controls
- Profile updates cover name, email, and custom fields while sending confirmation emails when necessary.
- Linked-account management connects or disconnects OAuth providers on demand.
- Users can trigger password setup flows even if they originally joined with OAuth.

## Organization Workspace
- Users create or join organizations, switch contexts, invite team members, and cancel pending invites.
- Invitations can be accepted or rejected, instantly updating the active organization.
- Role-based badges clarify ownership, admin, and member capabilities throughout the UI.

## Admin Console
- Admins gain dashboards for listing users, impersonating, banning, unbanning, and deleting accounts.
- Session revocation and user removal actions run behind confirmation prompts with toast feedback.
- A floating indicator reminds admins when they are impersonating and offers a quick exit.

## Transactional Email Automations
- Welcome, verification, password reset, delete-account, and organization invite emails send automatically.
- Each flow includes HTML and plain-text templates plus clear call-to-action copy.
- Environment-driven configuration keeps credentials and sender details out of the codebase.

# Requirements
- Node.js 20 or above
- PostgreSQL (Docker Compose file boots Postgres with persistence).
- Better Auth secrets: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- GitHub and Discord OAuth application credentials.
- Postmark server token and sender email (or update `lib/emails/send-email.ts` to stub email sending).

# Stack

## Language
- [**TypeScript**](https://www.typescriptlang.org/) adds type safety across server and client code.

## Front-End
- [**Next.js**](https://nextjs.org/) App Router with React Server Components, Route Handlers, and Turbopack dev builds.
- [**React**](https://react.dev/) powering the component layer and hooks.
- [**Tailwind CSS**](https://tailwindcss.com/) providing utility-first styling.
- [**Shadcn UI**](https://ui.shadcn.com/) supplying accessible component primitives and theming.
- [**Zod**](https://zod.dev/) enforcing schema validation on every auth flow.

## Back-End
- [**Better Auth**](https://docs.better-auth.com/) configured with session cookies, email/password, social OAuth, passkey, two-factor, admin, and organization plugins.
- [**PostgreSQL**](https://www.postgresql.org/) storing users, sessions, organizations, and invites.
- [**Drizzle ORM**](https://orm.drizzle.team/) delivering type-safe queries, migrations, and CLI helpers.
- [**Postmark**](https://postmarkapp.com/developer) sending transactional email flows.

# Design

## Better Auth Configuration
- `lib/auth/auth.ts` wires Better Auth with Postgres, custom `favoriteNumber` fields, change-email and delete-user verification, GitHub and Discord mapping, and cookie caching.
- Plugins enabled: `nextCookies`, `twoFactor`, `passkey`, `adminPlugin` (with custom access control), and `organization`.
- `createAuthMiddleware` fires welcome emails after sign-up, while `databaseHooks.session.create` injects the latest `activeOrganizationId`.
- Sessions track impersonation metadata, IP address, user agents, and the active organization so the UI can react without extra fetches.

## Data Model
- `drizzle/schemas/auth-schema.ts` declares tables for users, sessions, accounts, verifications, two-factor secrets, passkeys, organizations, members, and invitations.
- Relations cascade deletes to keep sessions, passkeys, and invites tidy when a user or organization disappears.
- `drizzle/db.ts` exports a typed client reused by Better Auth and server components.
- `drizzle.config.ts` points migrations to `drizzle/migrations`, keeping schema drift under version control.

## Session & Cookie Strategy
- Better Auth stores session and CSRF cookies via the `nextCookies` plugin, so tokens stay HTTP-only.
- Cookie caching is enabled for 60 seconds, reducing database lookups during rapid navigation.
- Client hooks subscribe to session changes and expose impersonation state for the floating indicator.
- Session revocation endpoints back both the profile page and the admin panel.

## Email Strategy
- All transactional flows call helpers in `lib/emails`, each of which delegates to `sendEmail`.
- Emails are sent for sign-up verification, password resets, welcome notices, delete-account approvals, and organization invitations.
- HTML bodies include branded CTAs, while text bodies keep emails accessible for plain clients.
- Invites rely on `BETTER_AUTH_URL` to build callback links to `/organizations/invites/:id`.

## Access Control & Organizations
- `components/auth/permissions.ts` creates roles via Better Auth’s access-control helper, granting `user:list` to base users and full CRUD to admins.
- `/admin/page.tsx` double-checks permissions with `auth.api.userHasPermission` before showing the dashboard.
- Organization helpers manage creation, invites, cancellations, accept or reject responses, and active-organization switching.
- Invitations and members are rendered client-side with Better Auth React hooks so updates propagate without reloads.

# Setting Up Project

## 1. Clone & Install
```sh
git clone https://github.com/mbeps/nextjs-betterauth-authentication.git
cd nextjs-betterauth-authentication
npm install
```

## 2. Start PostgreSQL (optional via Docker)
Set database env values and boot a Postgres container:
```sh
export DB_HOST=better-auth-db
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=better_auth
docker compose up -d
```
Alternatively, point `DATABASE_URL` to an existing Postgres instance.

## 3. Register OAuth Apps
Create GitHub and Discord OAuth apps with `http://localhost:3000/api/auth/callback/{provider}` as the callback URL. Copy client IDs and secrets for `.env.local`.

## 4. Configure Postmark
Create a Postmark Server Token and verified sender. Capture `POSTMARK_SERVER_TOKEN` and `POSTMARK_FROM_EMAIL`. If you do not want to send emails, replace `sendEmail` with a console logger.

## 5. Create `.env.local`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/better_auth
BETTER_AUTH_SECRET=change_me_super_secret
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
POSTMARK_SERVER_TOKEN=...
POSTMARK_FROM_EMAIL=hello@example.com
```
Add any Docker-only vars (`DB_*`) to a `.env` file for Compose.

## 6. Prepare the Database
```sh
npm run db:generate   # optional: inspect SQL before applying
npm run db:migrate    # runs drizzle-kit migrate
# or npm run db:push to sync schema directly
npm run auth:generate # regenerates schema when auth config changes
```

## 7. Run the App
```sh
npm run dev
# visit http://localhost:3000
```
`npm run build && npm run start` serves the production bundle.

# Usage

## Authentication Flow
1. Browse to `/auth/login`.
2. Sign up with email/password, GitHub, Discord, or a passkey. Email sign-up enforces verification before sign-in.
3. Two-factor challenges redirect to `/auth/2fa`, where TOTP or backup codes complete the login.
4. Password resets send links to `/auth/reset-password`, and delete requests email a confirmation link.

## Profile & Security
- `/profile` lets users update profile data, run password changes, toggle TOTP, add passkeys, set a password when they only have social accounts, link or unlink OAuth providers, and purge other sessions.
- The danger zone kicks off the delete-account verification email.
- Session cards show device fingerprints and expose one-click revocation.

## Organizations
- `/organizations` lets members create orgs, switch the active org, browse members, remove teammates, and manage pending invitations.
- `CreateInviteButton` emails new users an invite that resolves on `/organizations/invites/:id`.
- Accepting an invite sets the org active and redirects back to the dashboard.

## Admin Console
- Admins who hold the `user:list` permission visit `/admin` to review up to 100 users sorted by `createdAt`.
- Actions include impersonation, banning, unbanning, session revocation, and permanent deletion.
- While impersonating, the floating indicator provides a visible exit and keeps privileged admins from forgetting their context.

# References
- [Better Auth Docs](https://docs.better-auth.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Postmark Developer Docs](https://postmarkapp.com/developer)
- [GitHub OAuth Apps](https://docs.github.com/apps/oauth-apps)
- [Discord Developer Portal](https://discord.com/developers/docs/)
- [Shadcn UI](https://ui.shadcn.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
