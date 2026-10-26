"use client";

import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Represents message avatar props.
 *
 * @author Maruf Bepary
 */
interface MessageAvatarProps {
  isUser: boolean;
  image?: string | null;
  name?: string | null;
}

/**
 * Renders the message avatar component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function MessageAvatar({ isUser, image, name }: MessageAvatarProps) {
  return (
    <Avatar className="h-6 w-6">
      {isUser ? (
        <>
          <AvatarImage src={image ?? undefined} alt={name ?? ""} />
          <AvatarFallback className="bg-primary/10 text-primary">
            <User className="h-3 w-3" />
          </AvatarFallback>
        </>
      ) : (
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <Bot className="h-3 w-3" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}
