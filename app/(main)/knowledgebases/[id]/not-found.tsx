import { Library } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Knowledge base not found page — displays 404 UI when requested knowledge base does not exist.
 * Shows link back to knowledge bases list.
 */
export default function KnowledgebaseNotFound() {
  return (
    <NotFoundPage
      title="Knowledge base not found"
      description="This knowledge base does not exist or you don't have access to it."
      linkHref={ROUTES.KNOWLEDGEBASES.path}
      linkLabel="Back to knowledge bases"
      linkIcon={Library}
    />
  );
}
