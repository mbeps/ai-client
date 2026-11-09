import { SettingsPageSkeleton } from "@/components/skeletons/settings-page-skeleton";

/**
 * Streaming loading fallback for settings routes (/settings/*).
 *
 * @author Maruf Bepary
 */
export default function SettingsLoading() {
  return <SettingsPageSkeleton />;
}
