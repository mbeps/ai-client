"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { updateInternalToolApproval } from "@/actions/user-settings/update-internal-tool-approval";
import { InternalToolCard } from "@/components/settings/internal-tool-card";
import {
  parseInternalToolApprovals,
  resolveInternalToolApproval,
} from "@/config/tool-approval";
import type {
  INTERNAL_TOOL_CATALOGUE,
  InternalToolCategory,
} from "@/config/tools";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ToolPermissionMode } from "@/types/tool/approval";

type CatalogueEntry = (typeof INTERNAL_TOOL_CATALOGUE)[number];

/**
 * Props for {@link InternalToolsGrid}.
 */
export interface InternalToolsGridProps {
  groups: [InternalToolCategory, CatalogueEntry[]][];
}

const PERMISSION_TOAST_MESSAGE: Record<ToolPermissionMode, string> = {
  auto: "Tool set to auto-approve",
  ask: "Tool set to require approval",
  block: "Tool blocked",
};

/**
 * Client wrapper for `/settings/tools` that hydrates `userSettings` from the
 * store and persists per-tool internal permission overrides via
 * {@link updateInternalToolApproval}.
 */
export function InternalToolsGrid({ groups }: InternalToolsGridProps) {
  const userSettings = useAppStore((s) => s.userSettings);
  const loadUserSettings = useAppStore((s) => s.loadUserSettings);
  const updateUserSettingsState = useAppStore((s) => s.updateUserSettingsState);
  const [pendingTool, setPendingTool] = useState<string | null>(null);

  useEffect(() => {
    if (!userSettings) {
      void loadUserSettings();
    }
  }, [loadUserSettings, userSettings]);

  const overrides = useMemo(
    () => parseInternalToolApprovals(userSettings?.internalToolApprovals),
    [userSettings?.internalToolApprovals],
  );

  const handleToggleApproval = useCallback(
    async (toolName: string, nextApproval: ToolPermissionMode) => {
      setPendingTool(toolName);
      try {
        const res = await updateInternalToolApproval({
          toolName,
          approval: nextApproval,
        });
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        updateUserSettingsState(res.value);
        toast.success(PERMISSION_TOAST_MESSAGE[nextApproval]);
      } finally {
        setPendingTool(null);
      }
    },
    [updateUserSettingsState],
  );

  return (
    <>
      {groups.map(([category, tools]) => (
        <section key={category} className="space-y-2.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-base font-semibold tracking-tight">
              {category}
            </h2>
            <span className="text-muted-foreground text-xs">
              {tools.length} {tools.length === 1 ? "tool" : "tools"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {tools.map((tool) => (
              <InternalToolCard
                key={tool.id}
                name={tool.name}
                displayName={tool.displayName}
                description={tool.description}
                category={tool.category}
                approvalMode={resolveInternalToolApproval(tool.name, overrides)}
                defaultApproval={tool.defaultApproval}
                onToggleApproval={handleToggleApproval}
                disabled={pendingTool === tool.name}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
