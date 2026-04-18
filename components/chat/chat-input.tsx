"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Mic, Send, Paperclip, Wrench, Database } from "lucide-react";
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

/** Available AI model options shown in the model selector. Selection is display-only; no real model switching is wired up yet. */
type Model = { label: string; value: string };

const MODELS: Model[] = [
  { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
  { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet" },
];

/**
 * Props for the ChatInput component.
 *
 * @author Maruf Bepary
 */
interface ChatInputProps {
  /** Callback invoked with the trimmed message text when the user submits. */
  onSend: (content: string) => void;
  /** When true the Send button is disabled and submission is blocked. */
  isLoading?: boolean;
}

/**
 * Chat input area rendered at the bottom of each conversation.
 * Provides an auto-resizing textarea (capped at 200 px), Enter-to-send,
 * Shift+Enter for newlines, a display-only model selector, and an
 * attachment menu that switches from Popover to Drawer on mobile viewports.
 *
 * @param props.onSend - Called with the message string on submission.
 * @param props.isLoading - Disables the Send button during pending AI requests.
 * @author Maruf Bepary
 */
export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<Model>(MODELS[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
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

  const AttachmentsMenu = () => (
    <div className="flex flex-col gap-0.5 p-1">
      <Button variant="ghost" size="sm" className="justify-start">
        <Paperclip className="mr-2 h-4 w-4" /> Upload File
      </Button>
      <Button variant="ghost" size="sm" className="justify-start">
        <Database className="mr-2 h-4 w-4" /> Add Knowledgebase
      </Button>
      <Button variant="ghost" size="sm" className="justify-start">
        <Wrench className="mr-2 h-4 w-4" /> Select Tools
      </Button>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-3 py-2 bg-background border-t md:border md:rounded-2xl md:mb-4 shadow-sm md:bg-muted/30">
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
            <Drawer>
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
                <AttachmentsMenu />
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover>
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
                <AttachmentsMenu />
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
          <Button
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
