import { ROUTES } from "@/constants/routes";
import { redirect } from "next/navigation";

/**
 * Profile root page that redirects to the general settings tab.
 * Route: /profile. Server-side redirect — no UI rendered.
 * Protected route — requires active authentication.
 *
 * @returns Never returns; always redirects to /profile/general.
 * @see ProfileLayout for parent layout with sidebar.
 */
export default function ProfilePage() {
  redirect(ROUTES.PROFILE.GENERAL.path);
}
