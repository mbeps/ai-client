import { AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Represents attachment file card props.
 *
 * @author Maruf Bepary
 */
interface AttachmentFileCardProps {
  meta: { url: string; name: string };
  subtitle: string;
  variant: "output" | "input";
}

/**
 * Renders the attachment file card component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function AttachmentFileCard({
  meta,
  subtitle,
  variant,
}: AttachmentFileCardProps) {
  const isOutput = variant === "output";
  const cardBorderClass = isOutput
    ? "border-primary/10 bg-primary/5 hover:border-primary/30"
    : "border-muted bg-muted/20 hover:border-primary/20";
  const linkHoverClass = isOutput ? "hover:bg-primary/5" : "hover:bg-muted/30";
  const iconBorderClass = isOutput
    ? "border-primary/10 text-primary"
    : "border text-muted-foreground";
  const titleWeightClass = isOutput ? "font-bold" : "font-medium";

  return (
    <Card
      className={`group overflow-hidden py-0.5 transition-colors ${cardBorderClass}`}
    >
      <CardContent className="p-0">
        <a
          href={meta.url}
          download={meta.name}
          className={`flex items-center justify-between p-3 transition-colors ${linkHoverClass}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`bg-background rounded-lg p-2 shadow-sm ${iconBorderClass}`}
            >
              <Download className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p
                className={`max-w-[200px] truncate text-sm ${titleWeightClass}`}
              >
                {meta.name}
              </p>
              <p className="text-muted-foreground text-[10px]">{subtitle}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Download className="h-4 w-4" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

/**
 * Renders the storage notice component.
 *
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function StorageNotice() {
  return (
    <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4 backdrop-blur-sm">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">
            Storage Optimization
          </p>
          <p className="text-xs leading-relaxed text-blue-700/80">
            Intermediate step previews are temporary and stored in memory for
            the current session. Only the final result is saved to permanent
            storage.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Represents transform run files section props.
 *
 * @author Maruf Bepary
 */
export interface TransformRunFilesSectionProps {
  outputAttachmentIds?: string[];
  inputAttachmentIds?: string[];
  attachmentMeta: Record<string, { url: string; name: string }>;
  isCompleted: boolean;
}

/**
 * Files and storage section displaying input/output attachment cards and storage notice.
 */
export function TransformRunFilesSection({
  outputAttachmentIds,
  inputAttachmentIds,
  attachmentMeta,
  isCompleted,
}: TransformRunFilesSectionProps) {
  const hasOutputs = outputAttachmentIds && outputAttachmentIds.length > 0;
  const hasInputs = inputAttachmentIds && inputAttachmentIds.length > 0;
  const finalOutputId = hasOutputs
    ? outputAttachmentIds[outputAttachmentIds.length - 1]
    : undefined;

  return (
    <div className="space-y-4">
      {(hasOutputs || hasInputs) && (
        <div className="space-y-3">
          <h4 className="text-muted-foreground/70 flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <Download className="h-3 w-3" />
            Files & Workbooks
          </h4>
          <div className="grid gap-2">
            {outputAttachmentIds?.map((id: string) => {
              const meta = attachmentMeta[id];
              if (!meta) return null;
              const isFinal = isCompleted && id === finalOutputId;
              const subtitle = isFinal ? "Final Result" : "Step Output";
              return (
                <AttachmentFileCard
                  key={`out-${id}`}
                  meta={meta}
                  subtitle={subtitle}
                  variant="output"
                />
              );
            })}

            {inputAttachmentIds?.map((id: string) => {
              const meta = attachmentMeta[id];
              if (!meta) return null;
              return (
                <AttachmentFileCard
                  key={`in-${id}`}
                  meta={meta}
                  subtitle="Input File"
                  variant="input"
                />
              );
            })}
          </div>
        </div>
      )}

      <StorageNotice />
    </div>
  );
}
