"use client";

import { FileText, ShieldCheck } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { toggleDefaultAutoApprove } from "@/actions/user-settings/toggle-default-auto-approve";
import { GlobalPromptForm } from "@/components/settings/global-prompt-form";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store/use-app-store";
import type { UserSettingsFormData } from "@/schemas/user/user-settings";

interface GeneralSettingsTabsProps {
  initialSettings: Partial<UserSettingsFormData>;
}

/**
 * Tabbed general settings view for `/settings/app` using vertical `SidebarTabs`
 * synced to the `tab` URL query parameter via `nuqs`.
 */
export function GeneralSettingsTabs({
  initialSettings,
}: GeneralSettingsTabsProps) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("prompt").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const userSettings = useAppStore((s) => s.userSettings);
  const updateUserSettingsState = useAppStore((s) => s.updateUserSettingsState);
  const [isTogglingDefault, setIsTogglingDefault] = useState(false);

  const defaultAutoApprove = Boolean(
    userSettings?.defaultAutoApprove ?? initialSettings.defaultAutoApprove,
  );

  const handleToggleDefaultAutoApprove = useCallback(
    async (checked: boolean) => {
      setIsTogglingDefault(true);
      try {
        const res = await toggleDefaultAutoApprove(checked);
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        updateUserSettingsState(res.value);
        toast.success(
          checked
            ? "Auto-approve enabled by default for all chats"
            : "Auto-approve disabled by default",
        );
      } finally {
        setIsTogglingDefault(false);
      }
    },
    [updateUserSettingsState],
  );

  return (
    <SidebarTabs value={tab} onValueChange={setTab} className="w-full">
      <SidebarTabsList>
        <SidebarTabsTrigger value="prompt">
          <FileText className="size-4" />
          Global Prompt
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="auto-approve">
          <ShieldCheck className="size-4" />
          Auto-Approve
        </SidebarTabsTrigger>
      </SidebarTabsList>

      <SidebarTabsContent value="prompt" className="w-full flex-1">
        <GlobalPromptForm initialSettings={initialSettings} />
      </SidebarTabsContent>

      <SidebarTabsContent value="auto-approve" className="w-full flex-1">
        <Card className="py-5">
          <CardHeader className="px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck className="text-primary size-4" />
                  Auto-approve all tools by default
                </CardTitle>
                <CardDescription>
                  When enabled, all chats start with auto-approve turned on so
                  tools run without asking for confirmation. You can still
                  toggle this per chat.
                </CardDescription>
              </div>
              <Switch
                aria-label="Auto-approve by default for all chats"
                checked={defaultAutoApprove}
                disabled={isTogglingDefault}
                onCheckedChange={handleToggleDefaultAutoApprove}
              />
            </div>
          </CardHeader>
        </Card>
      </SidebarTabsContent>
    </SidebarTabs>
  );
}
