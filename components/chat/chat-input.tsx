"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Mic,
  Send,
  Square,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Attachment, McpServer } from "@/lib/store";
import { AttachmentsMenu } from "./attachments-menu";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { toast } from "sonner";
import { MODELS } from "@/models";
import { Model } from "@/types/model";

interface ChatInputProps {
  onSend: (
    content: string,
    attachments: Attachment[],
    model: string,
    selectedServerIds: string[],
  ) => void;
  isLoading?: boolean;
  onStop?: () => void;
  servers?: McpServer[];
}

export function ChatInput({
  onSend,
  isLoading,
  onStop,
  servers,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<Model>(MODELS[0]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    new Set(),
  );
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const localNew: Attachment[] = [];
      for (const file of Array.from(files)) {
        try {
          const att = await processAttachment(file, [
            ...attachments,
            ...localNew,
          ]);
          localNew.push(att);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      }
      if (localNew.length > 0) {
        setAttachments((prev) => [...prev, ...localNew]);
      }
    },
    [attachments],
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSend(input, attachments, model.value, Array.from(selectedServerIds));
      setInput("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const toggleServer = (id: string) => {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={`w-full max-w-4xl mx-auto px-3 py-2 bg-background border-t md:border md:rounded-2xl md:mb-4 shadow-sm md:bg-muted/30 transition-colors ${isDragging ? "ring-2 ring-primary bg-primary/5" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,.md"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs"
            >
              {att.type === "image" ? (
                att.dataUrl ? (
                  <Image
                    src={att.dataUrl}
                    alt={att.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded object-cover"
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything... Use / for commands, @ for tools"
        className="min-h-[40px] resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 overflow-y-auto"
        rows={1}
      />

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          {isMobile ? (
            <Drawer
              onOpenChange={(open) => {
                if (!open) setShowToolsPanel(false);
              }}
            >
              <DrawerTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <AttachmentsMenu
                  showToolsPanel={showToolsPanel}
                  setShowToolsPanel={setShowToolsPanel}
                  servers={servers}
                  selectedServerIds={selectedServerIds}
                  toggleServer={toggleServer}
                  fileInputRef={fileInputRef}
                />
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover
              onOpenChange={(open) => {
                if (!open) setShowToolsPanel(false);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-1">
                <AttachmentsMenu
                  showToolsPanel={showToolsPanel}
                  setShowToolsPanel={setShowToolsPanel}
                  servers={servers}
                  selectedServerIds={selectedServerIds}
                  toggleServer={toggleServer}
                  fileInputRef={fileInputRef}
                />
              </PopoverContent>
            </Popover>
          )}

          <Combobox
            items={MODELS}
            value={model}
            onValueChange={(val) => val && setModel(val as Model)}
            itemToStringValue={(m) => (m as Model).label}
          >
            <ComboboxInput
              placeholder={model.label}
              className="h-7 w-[180px] border-none bg-transparent shadow-none text-xs text-muted-foreground"
              showClear={false}
            />
            <ComboboxContent>
              <ComboboxEmpty>No models found.</ComboboxEmpty>
              <ComboboxList>
                {(m) => (
                  <ComboboxItem key={(m as Model).value} value={m}>
                    {(m as Model).label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Mic className="h-3.5 w-3.5" />
          </Button>
          {isLoading ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7 rounded-full"
              onClick={onStop}
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
            >
              <Send className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
