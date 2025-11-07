import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Base card container with consistent padding and elevation.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the container.
 * @returns Card wrapper element.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

/**
 * Card section reserved for titles, descriptions, or actions.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the section.
 * @returns Structured header region.
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

/**
 * Typography wrapper for card headings.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the title.
 * @returns Title element with consistent font weight.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

/**
 * Subheading text displayed beneath the card title.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the description.
 * @returns Description element styled for secondary copy.
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

/**
 * Layout region for header-level actions such as buttons.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the action slot.
 * @returns Positioned action container.
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

/**
 * Main card body that holds interactive or textual content.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the section.
 * @returns Content container with horizontal padding.
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

/**
 * Bottom-aligned card section for supporting actions or meta info.
 * @param className Optional class names to extend styling.
 * @param props Native div props forwarded to the section.
 * @returns Footer container that mirrors header spacing.
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
