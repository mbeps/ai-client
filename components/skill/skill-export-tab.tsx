"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Props for the SkillExportTab component.
 *
 * @author Maruf Bepary
 */
export interface SkillExportTabProps {
  onExport: () => Promise<void> | void;
  isExporting: boolean;
  skillName: string;
}

/**
 * Skill export tab component allowing users to download the complete skill package as a zip bundle.
 *
 * @author Maruf Bepary
 */
export function SkillExportTab({
  onExport,
  isExporting,
  skillName,
}: SkillExportTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Export Skill</h3>
        <p className="text-muted-foreground text-sm">
          Download this skill package for backup, migration, or sharing.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Skill Package Bundle</CardTitle>
          <CardDescription>
            Download a ZIP archive containing all files in this skill (
            {skillName}), including SKILL.md, prompts, and bundled assets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download ZIP Bundle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
