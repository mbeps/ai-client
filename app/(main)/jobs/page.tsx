import type { Metadata } from "next";
import { JobsView } from "@/components/jobs/jobs-view";
import { PageContainer } from "@/components/shared/page-container";

export const metadata: Metadata = {
  title: "Running Jobs | AI Client",
  description: "Monitor and manage background jobs tracked by Inngest.",
};

/**
 * Running Jobs overview page.
 * Server component host rendering the interactive JobsView dashboard within PageContainer.
 *
 * @author Maruf Bepary
 */
export default function JobsPage() {
  return (
    <PageContainer className="space-y-6">
      <JobsView />
    </PageContainer>
  );
}
