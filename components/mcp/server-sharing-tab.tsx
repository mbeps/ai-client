"use client";

import { Globe, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { toggleMcpServerPublic } from "@/actions/mcp-servers/toggle-mcp-server-public";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";

/**
 * Props for ServerSharingTab component.
 *
 * @interface ServerSharingTabProps
 */
export interface ServerSharingTabProps {
  /**
   * Unique identifier of the MCP server.
   * Used to locate the server in state and toggle public sharing.
   */
  serverId: string;
}

/**
 * Tab panel for configuring MCP server community sharing.
 * Renders public sharing toggle and community guidelines warning without card wrappers.
 * Only applicable for owned (non-installed) MCP servers.
 *
 * @param props - Component props
 * @param props.serverId - ID of the server to manage public sharing for
 * @author Maruf Bepary
 */
export function ServerSharingTab({ serverId }: ServerSharingTabProps) {
  const [togglingPublic, setTogglingPublic] = useState(false);

  const { server, loadMcpServers } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
      loadMcpServers: state.loadMcpServers,
    })),
  );

  if (!server || server.isInstalled) return null;

  async function handleTogglePublic() {
    if (!server) return;
    setTogglingPublic(true);
    try {
      await toggleMcpServerPublic(serverId);
      toast.success(`Server is now ${!server.isPublic ? "public" : "private"}`);
      await loadMcpServers();
    } catch {
      toast.error("Failed to toggle public status");
    } finally {
      setTogglingPublic(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 font-semibold text-lg">
          <Globe className="h-5 w-5 text-primary" />
          Public Sharing
        </h3>
        <p className="text-muted-foreground text-sm">
          Share this MCP server with the community to allow other users to
          discover and use its tools.
        </p>
      </div>

      <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="public-toggle" className="text-base">
            Make this server public
          </Label>
          <p className="text-muted-foreground text-sm">
            When enabled, anyone can find and use this server in their chats.
          </p>
        </div>
        <Switch
          id="public-toggle"
          checked={server.isPublic}
          onCheckedChange={handleTogglePublic}
          disabled={togglingPublic}
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-muted-foreground">
          <p className="font-medium text-foreground">Important Note</p>
          <p>
            Public servers are accessible to all users on the platform. Ensure
            that your server does not expose sensitive data or internal functions
            that should remain private.
          </p>
        </div>
      </div>
    </div>
  );
}

