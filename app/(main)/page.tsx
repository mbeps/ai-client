"use client";

import { Sparkles } from "lucide-react";
import { ChatUI } from "@/components/chat/chat-ui";
import { authClient } from "@/lib/auth/auth-client";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";

/**
 * Dashboard home page reusing ChatUI in lazy-create mode with welcome greeting
 * as the empty-thread state.
 * Route: /. Protected route — requires active authentication session.
 *
 * @author Maruf Bepary
 */
export default function HomePage() {
  const { data: session } = authClient.useSession();
  const draftResetNonce = useChatToolsStore((s) => s.draftResetNonce);

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-10 md:py-16">
      <div className="space-y-2 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Sparkles className="text-primary h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Hello, {session?.user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          How can I help you today?
        </p>
      </div>
    </div>
  );

  return <ChatUI key={draftResetNonce} emptyState={emptyState} />;
}
