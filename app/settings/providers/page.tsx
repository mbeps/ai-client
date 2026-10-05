import { Database } from "lucide-react";
import { getUserSettings } from "@/actions/user-settings/get-user-settings";
import { PageHeader } from "@/components/page-header";
import { ProviderSettingsClient } from "@/components/settings/providers/provider-settings-client";
import { PageContainer } from "@/components/shared/page-container";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Provider settings page — server component for managing AI provider integrations.
 * Route: /settings/providers. Features: configure providers (OpenRouter, Ollama, Groq, Azure, DeepSeek, etc),
 * manage API keys, set default model, registry import/export.
 *
 * @author Maruf Bepary
 * @see ProviderSettingsClient for client-side configuration UI
 */
export default async function ProviderSettingsPage() {
  await requireSession();
  const settings = await getUserSettings();

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        icon={<Database className="size-8" />}
        title="Providers"
        description="Manage AI providers, models, defaults, and registry imports/exports."
      />
      <ProviderSettingsClient initialSettings={settings} />
    </PageContainer>
  );
}
