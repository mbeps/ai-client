"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PublicServerDiscovery } from "./public-server-discovery";
import { Globe } from "lucide-react";

/**
 * Dialog wrapper for the PublicServerDiscovery component.
 */
interface DiscoverCommunityToolsDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Callback fired when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
}

/**
 * DiscoverCommunityToolsDialog allows users to browse and add community-shared MCP servers
 * through a focused modal experience.
 *
 * @author GitHub Copilot
 */
export function DiscoverCommunityToolsDialog({
  open,
  onOpenChange,
}: DiscoverCommunityToolsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 sr-only">
          <DialogTitle>Discover Community Tools</DialogTitle>
          <DialogDescription>
            Find and add publicly shared MCP servers from the community.
          </DialogDescription>
        </DialogHeader>

        <PublicServerDiscovery onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
