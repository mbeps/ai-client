import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth/auth";
import { AccountDeletion } from "../_components/account/account-deletion";

/**
 * Danger zone page for critical account actions including permanent account deletion.
 * Requires email confirmation to prevent accidental data loss.
 * Route: /profile/danger. Protected by session auth.
 *
 * @author Maruf Bepary
 */
export default async function DangerZonePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl tracking-tight">Danger Zone</h2>
        <p className="text-muted-foreground">
          Critical actions that can have permanent consequences for your
          account.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-destructive text-lg">
            Delete Account
          </h3>
          <p className="text-muted-foreground text-sm">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
        </div>
        <AccountDeletion />
      </div>
    </div>
  );
}
