"use client";

import { ComponentProps } from "react";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Wraps `ActionButton` with Better Auth's `{ error }` response shape.
 * The canonical pattern for all Better Auth mutations in the app. Normalises
 * `{ error: null | { message } }` into `ActionButton`'s `{ error: boolean }` shape
 * and forwards toast feedback and the optional confirmation dialog.
 *
 * @param props.action - Better Auth mutation; must return `{ error: null | { message? } }`
 * @param props.successMessage - Toast message shown on success; omit to suppress
 * @author Maruf Bepary
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
