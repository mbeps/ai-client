"use client";

import { BrainCircuit, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { SkillCard } from "@/components/skill/skill-card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { sortByName } from "@/lib/sort-by-name";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Agent Skills listing page.
 * Displays all user skills with search, scope filtering, enable/disable switches, and actions to create or upload skills.
 * Displays skills in alphabetical order by name to prevent layout jumping when toggled or updated.
 *
 * @author Maruf Bepary
 */
export default function SkillsPage() {
  const skills = useAppStore((state) => state.skills);
  const loadSkills = useAppStore((state) => state.loadSkills);
  const [scopeFilter, setScopeFilter] = useState<
    "all" | "global" | "project" | "assistant"
  >("all");

  return (
    <ResourceListPage
      icon={<BrainCircuit className="text-primary h-8 w-8" />}
      title="Agent Skills"
      description="Modular instructions and workflows that give AI models specialized domain capabilities."
      items={skills}
      columns={2}
      renderCard={(skill) => <SkillCard skill={skill} />}
      emptyStateMessage="No skills configured yet. Create a skill or upload an Open Agent Skills package (.md or .zip)."
      searchPlaceholder="Search skills by name, slug, description..."
      onMount={loadSkills}
      sortFn={sortByName}
      action={
        <div className="flex w-full items-center gap-2 md:w-auto">
          <Button variant="outline" asChild className="w-full gap-2 md:w-auto">
            <Link href={`${ROUTES.SETTINGS.SKILLS.new}?tab=upload`}>
              <Upload className="h-4 w-4" />
              Upload Skill
            </Link>
          </Button>
          <Button asChild className="w-full gap-2 md:w-auto">
            <Link href={`${ROUTES.SETTINGS.SKILLS.new}?tab=create`}>
              <Plus className="h-4 w-4" />
              New Skill
            </Link>
          </Button>
        </div>
      }
      extraFilters={
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "global", "project", "assistant"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={scopeFilter === s ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setScopeFilter(s)}
            >
              {s === "all"
                ? "All"
                : s === "global"
                  ? "Global"
                  : s === "project"
                    ? "Projects"
                    : "Assistants"}
            </Button>
          ))}
        </div>
      }
      customFilterFn={(s) => {
        const isGlobal =
          (!s.projectIds || s.projectIds.length === 0) &&
          (!s.assistantIds || s.assistantIds.length === 0);
        if (scopeFilter === "global") return isGlobal;
        if (scopeFilter === "project")
          return Boolean(s.projectIds && s.projectIds.length > 0);
        if (scopeFilter === "assistant")
          return Boolean(s.assistantIds && s.assistantIds.length > 0);
        return true;
      }}
      filterFn={(s, q) =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.displayName.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase()) ||
        s.content.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
