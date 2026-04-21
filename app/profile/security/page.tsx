import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SecurityTab } from "../_components/security/security-tab";
import { LoadingSuspense } from "../_components/shared/loading-suspense";

/**
 * Security settings page.
 * @returns Server-rendered security tools.
 */
export default async function SecurityPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Security</h2>
        <p className="text-muted-foreground">
          Manage your password, two-factor authentication, and account security.
        </p>
      </div>
      <LoadingSuspense>
        <SecurityTab
          email={session.user.email}
          isTwoFactorEnabled={session.user.twoFactorEnabled ?? false}
        />
      </LoadingSuspense>
    </div>
  );
}
