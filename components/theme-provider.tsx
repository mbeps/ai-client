"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Application-wide theme provider wrapping `next-themes`.
 * Syncs the `.dark` class on `<html>` with user preference (`system`, `light`, `dark`)
 * and exposes `useTheme` across client components (Shadcn UI, BlockNote, Sonner, Mermaid).
 *
 * @param props - Props forwarded to `NextThemesProvider`.
 * @returns Theme context provider wrapping application children.
 * @author Maruf Bepary
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
