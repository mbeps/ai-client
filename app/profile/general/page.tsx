import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth/auth";
import { ProfileUpdateForm } from "../_components/profile/profile-update-form";

/**
 * General profile settings page for updating user name and viewing email address.
 * Renders profile update form with validation via Better Auth.
 * Route: /profile/general. Protected by session auth.
 *
 * @author Maruf Bepary
 */
export default async function GeneralProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl tracking-tight">General Settings</h2>
        <p className="text-muted-foreground">
          Update your personal information and how it appears to others.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-lg">Profile Information</h3>
          <p className="text-muted-foreground text-sm">
            This information will be displayed on your public profile.
          </p>
        </div>
        <ProfileUpdateForm user={session.user} />
      </div>
    </div>
  );
}
