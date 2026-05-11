"use client";

import { NotFoundMessage } from "@/components/not-found-message";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { Database, FileText, Calendar } from "lucide-react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useEffect } from "react";

export default function KnowledgebasePage() {
  const params = useParams();
  const kbId = params.id as string;
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const kb = knowledgebases.find((k) => k.id === kbId);
  const loadKnowledgebases = useAppStore((state) => state.loadKnowledgebases);

  useEffect(() => {
    if (knowledgebases.length === 0) {
      loadKnowledgebases().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!kb) return <NotFoundMessage entity="Knowledgebase" />;

  return (
    <div className="page-container-detail">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{kb.name}</h1>
        {kb.description && (
          <p className="text-muted-foreground">{kb.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </CardDescription>
            <CardTitle className="text-2xl">{kb.documentCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              No documents have been uploaded yet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created
            </CardDescription>
            <CardTitle className="text-base font-medium">
              {format(kb.createdAt, "PPP")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Last updated {format(kb.updatedAt, "PPP")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
