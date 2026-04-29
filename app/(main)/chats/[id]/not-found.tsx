import { NotFoundPage } from "@/components/shared/not-found-page";

export default function ChatNotFound() {
  return (
    <NotFoundPage
      title="Chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref="/chats"
      linkLabel="Back to chats"
    />
  );
}
