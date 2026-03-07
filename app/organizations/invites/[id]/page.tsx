import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { organization } from "better-auth/plugins/organization";
import { InviteInformation } from "./_components/invite-information";

/**
 * Invitation landing page that lets users accept or reject organization invites.
 * @param params Route params containing the invitation identifier.
 * @returns Server-rendered invitation page gated behind authentication.
 */
export default async function InvitationPage({
  params,
}: PageProps<"/organizations/invites/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  const organizationApi = auth.api as typeof auth.api &
    ReturnType<typeof organization>["endpoints"];
  // Force login before revealing invitation details.
  if (session == null) return redirect(ROUTES.AUTH.LOGIN);

  const { id } = await params;

  const invitation = await organizationApi
    .getInvitation({
      headers: await headers(),
      query: { id },
    })
    .catch(() => redirect(ROUTES.HOME));

  return (
    <div className="container mx-auto my-6 max-w-2xl px-4">
      <Card>
        <CardHeader>
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>
            You have been invited to join the {invitation.organizationName}{" "}
            organization as a {invitation.role}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteInformation invitation={invitation} />
        </CardContent>
      </Card>
    </div>
  );
}
