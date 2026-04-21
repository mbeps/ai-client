import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LinkedAccountsTab } from "../_components/account/linked-accounts-tab";
import { LoadingSuspense } from "../_components/shared/loading-suspense";

/**
 * Linked accounts management page.
 * @returns Server-rendered linked accounts list.
 */
export default async function LinkedAccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Linked Accounts</h2>
        <p className="text-muted-foreground">
          Connect your account with other services for easier login.
        </p>
      </div>
      <LoadingSuspense>
        <LinkedAccountsTab />
      </LoadingSuspense>
    </div>
  );
}
