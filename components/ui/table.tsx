"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Table wrapper that enables horizontal scrolling on small screens.
 * @param className Optional class names to extend styling.
 * @param props Native table props forwarded to the element.
 * @returns Table element wrapped in a responsive container.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

/**
 * Table header element that preserves border styling.
 * @param className Optional class names to extend styling.
 * @param props Native thead props forwarded to the element.
 * @returns Styled table header.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

/**
 * Table body wrapper that removes the final row border.
 * @param className Optional class names to extend styling.
 * @param props Native tbody props forwarded to the element.
 * @returns Styled table body element.
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

/**
 * Table footer region for totals or summary values.
 * @param className Optional class names to extend styling.
 * @param props Native tfoot props forwarded to the element.
 * @returns Styled table footer element.
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Table row component with hover and selection states.
 * @param className Optional class names to extend styling.
 * @param props Native tr props forwarded to the element.
 * @returns Styled table row element.
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

/**
 * Table header cell with typography defaults and checkbox alignment tweaks.
 * @param className Optional class names to extend styling.
 * @param props Native th props forwarded to the element.
 * @returns Styled table header cell.
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Table body cell with consistent padding and checkbox alignment.
 * @param className Optional class names to extend styling.
 * @param props Native td props forwarded to the element.
 * @returns Styled table body cell.
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Caption element used for table descriptions or metrics.
 * @param className Optional class names to extend styling.
 * @param props Native caption props forwarded to the element.
 * @returns Styled table caption element.
 */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
