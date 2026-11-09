import { Cpu } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * Model not found page — displays 404 UI when requested model does not exist.
 * Shows link back to models list under provider settings.
 *
 * @author Maruf Bepary
 */
export default function ModelNotFound() {
  return (
    <NotFoundPage
      title="Model not found"
      description="This AI model does not exist or you don't have access to it."
      linkHref={ROUTES.SETTINGS.MODELS.path}
      linkLabel="Back to models"
      linkIcon={Cpu}
    />
  );
}
