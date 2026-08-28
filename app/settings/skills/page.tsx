"use client";

import { useAppStore } from "@/lib/store";
import { BrainCircuit, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillCard } from "@/components/skill/skill-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { ROUTES } from "@/constants/routes";
import Link from "next/link";

/**
 * Agent Skills listing page.
 * Displays all user skills with search, enable/disable switches, and actions to create or upload skills.
 *
 * @author Maruf Bepary
 */
export default function SkillsPage() {
  const skills = useAppStore((state) => state.skills);
  const loadSkills = useAppStore((state) => state.loadSkills);

  return (
    <ResourceListPage
      icon={<BrainCircuit className="h-8 w-8 text-primary" />}
      title="Agent Skills"
      description="Modular instructions and workflows that give AI models specialized domain capabilities."
      items={skills}
      renderCard={(skill) => <SkillCard skill={skill} />}
      emptyStateMessage="No skills configured yet. Create a skill or upload an Open Agent Skills package (.md or .zip)."
      searchPlaceholder="Search skills by name, slug, description..."
      onMount={loadSkills}
      action={
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" asChild className="w-full md:w-auto gap-2">
            <Link href={`${ROUTES.SETTINGS.SKILLS.new}?tab=upload`}>
              <Upload className="h-4 w-4" />
              Upload Skill
            </Link>
          </Button>
          <Button asChild className="w-full md:w-auto gap-2">
            <Link href={`${ROUTES.SETTINGS.SKILLS.new}?tab=create`}>
              <Plus className="h-4 w-4" />
              New Skill
            </Link>
          </Button>
        </div>
      }
      filterFn={(s, q) =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.displayName.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase()) ||
        s.content.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
