import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  redirect(ROUTES.SETTINGS.APP.path);
}
