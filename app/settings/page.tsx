import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/**
 * Settings root page that redirects to the app settings tab.
 * Route: /settings. Server-side redirect — no UI rendered.
 * Protected route — requires active authentication.
 *
 * @returns Never returns; always redirects to /settings/app.
 * @see SettingsLayout for parent layout with sidebar.
 * @author Maruf Bepary
 */
export default function SettingsPage() {
  redirect(ROUTES.SETTINGS.APP.path);
}
