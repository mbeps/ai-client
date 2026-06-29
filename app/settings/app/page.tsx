import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { GlobalPromptForm } from "@/components/settings/global-prompt-form";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth/require-session";
import { Settings2 } from "lucide-react";

/**
 * Application general settings page — server component for managing global app preferences.
 * Route: /settings/app. Features: default system prompt configuration, application-wide customizations.
 * Settings are persisted to database and affect all chat interactions.
 *
 * @author Maruf Bepary
 * @see GlobalPromptForm for configuration form component
 */
export default async function SettingsPage() {
  await requireSession();
  const settings = await getUserSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings2 className="size-8" />}
        title="General Settings"
        description="Manage your application-wide preferences and configurations."
      />
      <GlobalPromptForm initialSettings={settings ?? {}} />
    </div>
  );
}
