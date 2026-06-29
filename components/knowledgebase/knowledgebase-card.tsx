"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import { Database, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { KnowledgebaseOptions } from "./knowledgebase-options";
import { cn } from "@/lib/utils";

interface KnowledgebaseCardProps {
  knowledgebase: Knowledgebase;
  onAfterMutation?: () => void;
}

/**
 * Card displaying knowledgebase name, description, and indexing status.
 * Clicking navigates to the knowledgebase detail page; options menu provides Rename and Delete actions.
 * Shows status badges for indexing state and stale index warnings.
 *
 * @param props.knowledgebase - Knowledgebase entity with name, description, and indexing status.
 * @param props.onAfterMutation - Optional callback invoked after rename/delete mutations.
 * @author Maruf Bepary
 */
export function KnowledgebaseCard({
  knowledgebase: kb,
  onAfterMutation,
}: KnowledgebaseCardProps) {
  const router = useRouter();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[100px]"
      onClick={() => router.push(ROUTES.KNOWLEDGEBASES.detail(kb.id))}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-none truncate">{kb.name}</h3>
              {kb.indexStatus === "stale" && (
                <Badge
                  variant="warning"
                  className="h-4 px-1 text-[8px] uppercase"
                >
                  <AlertTriangle className="mr-0.5 h-2 w-2" />
                  Stale
                </Badge>
              )}
              {kb.indexStatus === "indexing" && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[8px] uppercase text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                >
                  <Loader2 className="mr-0.5 h-2 w-2 animate-spin" />
                  Indexing
                </Badge>
              )}
            </div>
            {kb.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {kb.description}
              </p>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <KnowledgebaseOptions kb={kb} onAfterMutation={onAfterMutation} />
        </div>
      </div>
    </Card>
  );
}
