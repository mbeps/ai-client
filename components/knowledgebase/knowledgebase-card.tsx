"use client";

import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { Knowledgebase } from "@/types/knowledgebase";
import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { KnowledgebaseOptions } from "./knowledgebase-options";

interface KnowledgebaseCardProps {
  knowledgebase: Knowledgebase;
}

export function KnowledgebaseCard({
  knowledgebase: kb,
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
            <h3 className="font-semibold leading-none truncate">{kb.name}</h3>
            {kb.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {kb.description}
              </p>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <KnowledgebaseOptions kb={kb} />
        </div>
      </div>
    </Card>
  );
}
