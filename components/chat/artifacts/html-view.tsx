"use client";

import { AlertCircle } from "lucide-react";

export interface HtmlViewProps {
  content: string;
}

export default function HtmlView({ content }: HtmlViewProps) {
  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>No HTML content to display.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-white relative">
      <iframe
        srcDoc={content}
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        title="HTML Preview"
      />
    </div>
  );
}
