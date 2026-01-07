"use client";

import { ComponentProps } from "react";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Wraps `ActionButton` with Better Auth's error shape and optional success toast.
 * @param action Callback that performs the Better Auth operation.
 * @param successMessage Optional message displayed when the action succeeds.
 * @returns Rendered button configured for Better Auth mutations.
 */
export function BetterAuthActionButton({
  action,
  successMessage,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "action"> & {
  action: () => Promise<{ error: null | { message?: string } }>;
  successMessage?: string;
}) {
  return (
    <ActionButton
      {...props}
      action={async () => {
        const res = await action();

        if (res.error) {
          return { error: true, message: res.error.message || "Action failed" };
        } else {
          return { error: false, message: successMessage };
        }
      }}
    />
  );
}
