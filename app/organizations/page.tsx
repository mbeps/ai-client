import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { ROUTES } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OrganizationSelect } from "./_components/select/organization-select";
import { CreateOrganizationButton } from "./_components/buttons/create-organization-button";
import { OrganizationTabs } from "./_components/tabs/organization-tabs";

/**
 * Organizations dashboard where members switch, create, and manage teams.
 * @returns Server-rendered organizations page.
 */
export default async function OrganizationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // Require authentication before accessing organization resources.
  if (session == null) return redirect(ROUTES.AUTH.LOGIN);

  return (
    <div className="container mx-auto my-6 px-4">
      <Link href={ROUTES.HOME} className="inline-flex items-center mb-6">
        <ArrowLeft className="size-4 mr-2" />
        Back to Home
      </Link>

      <div className="flex items-center mb-8 gap-2">
        <OrganizationSelect />
        <CreateOrganizationButton />
      </div>

      <OrganizationTabs />
    </div>
  );
}
