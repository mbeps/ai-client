"use client";

import { AlertTriangle, Database, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import { KnowledgebaseOptions } from "./knowledgebase-options";

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
      className="group flex min-h-[100px] cursor-pointer flex-col justify-between p-4 transition-colors hover:bg-muted/50"
      onClick={() => router.push(ROUTES.KNOWLEDGEBASES.detail(kb.id))}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold leading-none">{kb.name}</h3>
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
                  className="h-4 border-blue-200 bg-blue-50 px-1 text-[8px] text-blue-500 uppercase dark:bg-blue-950/20"
                >
                  <Loader2 className="mr-0.5 h-2 w-2 animate-spin" />
                  Indexing
                </Badge>
              )}
            </div>
            {kb.description && (
              <p className="line-clamp-2 text-muted-foreground text-sm">
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
