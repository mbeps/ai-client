import { Database } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/actions/require-session";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { ProviderSettingsClient } from "@/components/settings/providers/provider-settings-client";

export default async function ProviderSettingsPage() {
  await requireSession();
  const settings = await getUserSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Database className="size-8" />}
        title="Providers"
        description="Manage AI providers, models, defaults, and registry imports/exports."
      />
      <ProviderSettingsClient initialSettings={settings} />
    </div>
  );
}
