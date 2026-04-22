"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  Paperclip,
  Database,
  Wrench,
} from "lucide-react";
import type { McpServer } from "@/lib/store";

interface AttachmentsMenuProps {
  showToolsPanel: boolean;
  setShowToolsPanel: (show: boolean) => void;
  servers?: McpServer[];
  selectedServerIds: Set<string>;
  toggleServer: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const AttachmentsMenu = ({
  showToolsPanel,
  setShowToolsPanel,
  servers,
  selectedServerIds,
  toggleServer,
  fileInputRef,
}: AttachmentsMenuProps) => (
  <div className="flex flex-col gap-0.5 p-1">
    {showToolsPanel ? (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => setShowToolsPanel(false)}
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="px-1 py-0.5">
          {!servers || servers.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">
              No tools available
            </p>
          ) : (
            servers.map((server) => (
              <label
                key={server.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent text-sm"
              >
                <Checkbox
                  checked={selectedServerIds.has(server.id)}
                  onCheckedChange={() => toggleServer(server.id)}
                />
                <span className="truncate">{server.name}</span>
              </label>
            ))
          )}
        </div>
      </>
    ) : (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-2 h-4 w-4" /> Upload File
        </Button>
        <Button variant="ghost" size="sm" className="justify-start">
          <Database className="mr-2 h-4 w-4" /> Add Knowledgebase
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={!servers || servers.length === 0}
          onClick={() => setShowToolsPanel(true)}
        >
          <Wrench className="mr-2 h-4 w-4" />
          Select Tools
          {selectedServerIds.size > 0 ? ` (${selectedServerIds.size})` : ""}
        </Button>
      </>
    )}
  </div>
);
