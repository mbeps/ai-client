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
 * Props for DiscoverCommunityToolsDialog component.
 *
 * @interface DiscoverCommunityToolsDialogProps
 */
interface DiscoverCommunityToolsDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Callback fired when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog wrapper for discovering and adding community-shared MCP servers.
 * Allows users to browse and add public MCP servers through a focused modal experience.
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is visible
 * @param props.onOpenChange - Callback fired when dialog open state changes
 * @see {@link PublicServerDiscovery} for the discovery implementation
 * @see {@link AddServerDialog} for adding custom servers
 * @author Maruf Bepary
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
