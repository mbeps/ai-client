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
import { formatDistanceToNow } from "date-fns";
import { FileText, Trash2, Upload } from "lucide-react";
import { useParams } from "next/navigation";

/**
 * Knowledge base detail page showing storage usage and a mock document list.
 * Route: /knowledgebases/[id]. Reads the knowledge base from the Zustand store.
 * Document upload and deletion are UI-only.
 *
 * @author Maruf Bepary
 */
// Mock documents
const MOCK_DOCS = Array.from({ length: 5 }).map((_, i) => ({
  id: `doc${i}`,
  name: `Document_${i + 1}.pdf`,
  size: Math.random() * 5 * 1024 * 1024,
  date: new Date(Date.now() - Math.random() * 1000000000),
}));

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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{kb.name}</h1>
          <p className="text-muted-foreground">{kb.description}</p>
        </div>
        <Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Resources available for AI context.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {MOCK_DOCS.map((doc) => (
              <div
                key={doc.id}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(doc.size / (1024 * 1024)).toFixed(2)} MB • Uploaded{" "}
                      {formatDistanceToNow(doc.date, { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
