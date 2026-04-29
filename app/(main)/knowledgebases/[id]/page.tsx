"use client";

import { NotFoundMessage } from "@/components/not-found-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { Upload } from "lucide-react";

import { useParams } from "next/navigation";

/**
 * Knowledge base detail page showing storage usage.
 * Route: /knowledgebases/[id]. Reads the knowledge base from the Zustand store.
 *
 * @author Maruf Bepary
 */
export default function KnowledgebasePage() {
  const params = useParams();
  const kbId = params.id as string;
  const kb = useAppStore((state) =>
    state.knowledgebases.find((k) => k.id === kbId),
  );

  if (!kb) return <NotFoundMessage entity="Knowledgebase" />;

  const usagePercentage = Math.min(100, (kb.sizeBytes / kb.maxSizeBytes) * 100);

  return (
    <div className="page-container-detail">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
        <div>
          <h1 className="text-3xl font-bold">{kb.name}</h1>
          <p className="text-muted-foreground">{kb.description}</p>
        </div>
        <Button className="w-full md:w-auto">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
          <CardDescription>
            Capacity available for this knowledgebase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>
                {((kb.sizeBytes / kb.maxSizeBytes) * 100).toFixed(1)}% Used
              </span>
              <span className="text-muted-foreground">
                {((1 - kb.sizeBytes / kb.maxSizeBytes) * 100).toFixed(1)}%
                Available
              </span>
            </div>
            <div className="h-4 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full ${usagePercentage > 90 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
