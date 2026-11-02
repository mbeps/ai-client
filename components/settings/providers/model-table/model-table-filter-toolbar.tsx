"use client";

import {
  Binary,
  Boxes,
  CheckCircle2,
  CircleSlash,
  Cpu,
  Database,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Represents model table filter toolbar props.
 *
 * @author Maruf Bepary
 */
export type ModelTableFilterToolbarProps = {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  providerFilter: string;
  onProviderFilterChange: (val: string) => void;
  typeFilter: "all" | "chat" | "embedding" | "both";
  onTypeFilterChange: (val: "all" | "chat" | "embedding" | "both") => void;
  providers: AiProviderRow[];
};

/**
 * Renders the model table filter toolbar component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ModelTableFilterToolbar(props: ModelTableFilterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[200px] lg:w-[280px]">
        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
        <Input
          value={props.search}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder="Search models..."
          className="h-9 w-full pl-9"
        />
      </div>

      <Select
        value={props.statusFilter}
        onValueChange={props.onStatusFilterChange}
      >
        <SelectTrigger
          aria-label="Status filter"
          className="h-9 w-full sm:w-[145px]"
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <SlidersHorizontal className="text-muted-foreground size-4" />
            <span>Everything</span>
          </SelectItem>
          <SelectItem value="enabled">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Enabled</span>
          </SelectItem>
          <SelectItem value="disabled">
            <CircleSlash className="text-muted-foreground size-4" />
            <span>Disabled</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={props.providerFilter}
        onValueChange={props.onProviderFilterChange}
      >
        <SelectTrigger
          aria-label="Provider filter"
          className="h-9 w-full sm:w-[180px]"
        >
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <Database className="text-muted-foreground size-4" />
            <span>All providers</span>
          </SelectItem>
          {props.providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              <Cpu className="text-muted-foreground size-4" />
              <span>{provider.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.typeFilter}
        onValueChange={(value) =>
          props.onTypeFilterChange(
            value as "all" | "chat" | "embedding" | "both",
          )
        }
      >
        <SelectTrigger
          aria-label="Type filter"
          className="h-9 w-full sm:w-[140px]"
        >
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <Boxes className="text-muted-foreground size-4" />
            <span>All types</span>
          </SelectItem>
          <SelectItem value="chat">
            <MessageSquare className="text-muted-foreground size-4" />
            <span>Chat</span>
          </SelectItem>
          <SelectItem value="embedding">
            <Binary className="text-muted-foreground size-4" />
            <span>Embedding</span>
          </SelectItem>
          <SelectItem value="both">
            <Sparkles className="text-muted-foreground size-4" />
            <span>Both</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
