import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileUpdateForm } from "../_components/profile/profile-update-form";

/**
 * General profile settings page.
 * @returns Server-rendered profile update form.
 */
export default async function GeneralProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN.path);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General Settings</h2>
        <p className="text-muted-foreground">
          Update your personal information and how it appears to others.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Profile Information</h3>
          <p className="text-sm text-muted-foreground">
            This information will be displayed on your public profile.
          </p>
        </div>
        <ProfileUpdateForm user={session.user} />
      </div>
    </div>
  );
}
