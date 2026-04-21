import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDeletion } from "../_components/account/account-deletion";

/**
 * Danger zone page for critical actions.
 * @returns Server-rendered account deletion section.
 */
export default async function DangerZonePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Danger Zone</h2>
        <p className="text-muted-foreground">
          Critical actions that can have permanent consequences for your account.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-destructive">Delete Account</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
        <AccountDeletion />
      </div>
    </div>
  );
}
