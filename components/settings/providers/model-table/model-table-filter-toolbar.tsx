"use client";

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
      <Input
        value={props.search}
        onChange={(event) => props.onSearchChange(event.target.value)}
        placeholder="Search models..."
        className="h-9 w-full sm:w-[200px] lg:w-[280px]"
      />

      <Select
        value={props.statusFilter}
        onValueChange={props.onStatusFilterChange}
      >
        <SelectTrigger className="h-9 w-full sm:w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everything</SelectItem>
          <SelectItem value="enabled">Enabled</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={props.providerFilter}
        onValueChange={props.onProviderFilterChange}
      >
        <SelectTrigger className="h-9 w-full sm:w-[180px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All providers</SelectItem>
          {props.providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name}
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
        <SelectTrigger className="h-9 w-full sm:w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="chat">chat</SelectItem>
          <SelectItem value="embedding">embedding</SelectItem>
          <SelectItem value="both">both</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
