import { Database } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * Provider not found page — displays 404 UI when requested provider does not exist.
 * Shows link back to providers list.
 */
export default function ProviderNotFound() {
  return (
    <NotFoundPage
      title="Provider not found"
      description="This provider does not exist or you don't have access to it."
      linkHref={ROUTES.SETTINGS.PROVIDERS.path}
      linkLabel="Back to providers"
      linkIcon={Database}
    />
  );
}
