import { BrainCircuit } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Skill not found page — displays 404 UI when requested skill does not exist.
 * Shows link back to skills list.
 */
export default function SkillNotFound() {
  return (
    <NotFoundPage
      title="Skill not found"
      description="This agent skill does not exist or you don't have access to it."
      linkHref={ROUTES.SETTINGS.SKILLS.path}
      linkLabel="Back to skills"
      linkIcon={BrainCircuit}
    />
  );
}
