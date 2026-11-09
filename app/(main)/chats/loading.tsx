import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";

/**
 * Streaming loading fallback for chats list page (/chats).
 *
 * @author Maruf Bepary
 */
export default function ChatsLoading() {
  return <CardGridSkeleton />;
}
