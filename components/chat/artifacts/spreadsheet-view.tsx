"use client";

import { useMemo, useState } from "react";
import * as xlsx from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Download,
  Search,
  Sheet as SheetIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ArtifactSheet } from "@/types/artifact/artifact-sheet";
import type { ArtifactSpreadsheetData } from "@/types/artifact/artifact-spreadsheet-data";
import type { CellObject } from "@/types/artifact/cell-object";
import type { CellStyle } from "@/types/artifact/cell-style";
import { cn } from "@/lib/utils";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

/**
 * Props for SpreadsheetView artifact component.
 * Accepts either JSON-formatted spreadsheet data or CSV content.
 *
 * @author Maruf Bepary
 */
export interface SpreadsheetViewProps {
  /** Display title for the spreadsheet artifact. */
  title: string;
  /** XLSX or CSV-formatted spreadsheet content to render and make searchable. */
  content: string;
}

/**
 * Converts CellStyle properties to Tailwind classes and inline CSS styles.
 * Handles font weight, italics, text alignment, colors, and backgrounds.
 *
 * @param style - Cell styling object with optional bold, italic, alignment, colors
 * @returns Object with Tailwind classes and inline CSS styles to apply to cell
 * @author Maruf Bepary
 */
function getCellStyle(style?: CellStyle) {
  if (!style) return {};

  const styles: React.CSSProperties = {};
  if (style.backgroundColor) styles.backgroundColor = style.backgroundColor;
  if (style.color) styles.color = style.color;

  const classes = cn({
    "font-bold": style.bold,
    italic: style.italic,
    "text-left": style.textAlign === "left",
    "text-center": style.textAlign === "center",
    "text-right": style.textAlign === "right",
  });

  return { styles, classes };
}

/**
 * Parses spreadsheet content in multiple formats and returns normalized data structure.
 * Supports multi-sheet JSON, legacy JSON arrays, and CSV format with automatic fallback.
 *
 * @param content - Spreadsheet content as JSON string or CSV
 * @returns Normalized ArtifactSpreadsheetData with sheets array; empty sheets on parse failure
 * @author Maruf Bepary
 */
function useSpreadsheetData(content: string): ArtifactSpreadsheetData {
  return useMemo(() => {
    try {
      const parsed = JSON.parse(content);

      // Case 1: Multi-sheet structure
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.sheets)
      ) {
        return parsed as ArtifactSpreadsheetData;
      }

      // Case 2: Legacy Array of Objects or Arrays
      if (Array.isArray(parsed)) {
        return {
          sheets: [
            {
              name: "Sheet1",
              data: parsed,
            },
          ],
        };
      }
    } catch {
      // Ignore JSON parse errors, fallback to CSV
    }

    try {
      // Case 3: CSV fallback
      const workbook = xlsx.read(content, { type: "string" });
      const sheets: ArtifactSheet[] = workbook.SheetNames.map((name) => ({
        name,
        data: xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }),
      }));
      return { sheets };
    } catch (err) {
      console.error("Failed to parse spreadsheet content:", err);
      return { sheets: [] };
    }
  }, [content]);
}

/**
 * Renders multi-sheet spreadsheet artifacts with search, filtering, and XLSX export.
 * Supports multiple format inputs (JSON multi-sheet, legacy arrays, CSV).
 * Features global search, sheet navigation tabs, row indexing, and cell styling support.
 * Used in ArtifactPanel for spreadsheet artifact display and editing.
 *
 * @param title - Display title for the spreadsheet
 * @param content - Spreadsheet content (XLSX JSON, legacy array, or CSV format)
 * @returns Tabbed spreadsheet viewer with search, sheet tabs, filtering, and export functionality
 * @see useSpreadsheetData for content parsing logic
 * @author Maruf Bepary
 */
export default function SpreadsheetView({
  title,
  content,
}: SpreadsheetViewProps) {
  const spreadsheetData = useSpreadsheetData(content);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [globalFilter, setGlobalFilter] = useState("");

  const activeSheet = useMemo(() => {
    return (
      spreadsheetData.sheets[activeSheetIndex] || {
        name: "N/A",
        data: [],
      }
    );
  }, [spreadsheetData.sheets, activeSheetIndex]);

  // Transform sheet data into a format TanStack Table likes
  // We handle both AOOs (Array of Objects) and AOAs (Array of Arrays)
  const isAOA =
    activeSheet.data.length > 0 && Array.isArray(activeSheet.data[0]);

  const { headers, rows } = useMemo(() => {
    if (activeSheet.data.length === 0) return { headers: [], rows: [] };

    if (isAOA) {
      const headerRow = activeSheet.data[0] as any[];
      const dataRows = activeSheet.data.slice(1);

      const headers = headerRow.map((h, i) => {
        const val = typeof h === "object" && h !== null ? h.v : h;
        return String(val ?? `Column ${i + 1}`);
      });

      const rows = dataRows.map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });

      return { headers, rows };
    } else {
      // Array of Objects
      const keySet = new Set<string>();
      activeSheet.data.forEach((row: any) => {
        Object.keys(row).forEach((key) => keySet.add(key));
      });
      const headers = Array.from(keySet);
      return { headers, rows: activeSheet.data };
    }
  }, [activeSheet, isAOA]);

  const columnHelper = createColumnHelper<any>();
  const columns = useMemo(() => {
    return [
      columnHelper.display({
        id: "index",
        header: "#",
        cell: (info) => info.row.index + 1,
      }),
      ...headers.map((header) =>
        columnHelper.accessor(header, {
          header: header,
          cell: (info) => {
            const val = info.getValue();
            if (val && typeof val === "object" && "v" in val) {
              const cellObj = val as CellObject;
              const { styles, classes } = getCellStyle(cellObj.s);
              return (
                <div
                  style={styles}
                  className={cn("px-1 py-0.5 rounded", classes)}
                >
                  {String(cellObj.v ?? "")}
                </div>
              );
            }
            return String(val ?? "");
          },
        }),
      ),
    ];
  }, [headers, columnHelper]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleDownload = () => {
    try {
      const workbook = xlsx.utils.book_new();
      spreadsheetData.sheets.forEach((sheet) => {
        // Simple export: stripping styles for compatibility with basic sheet_to_json
        const flatData = sheet.data.map((row) =>
          row.map((cell) =>
            cell && typeof cell === "object" && "v" in cell ? cell.v : cell,
          ),
        );
        const worksheet = xlsx.utils.aoa_to_sheet(flatData);
        xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name);
      });
      const safeTitle = (title || "spreadsheet")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      xlsx.writeFile(workbook, `${safeTitle}.xlsx`);
    } catch (err) {
      console.error("Failed to export workbook:", err);
    }
  };

  if (spreadsheetData.sheets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>No valid spreadsheet data found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col w-full bg-background relative overflow-hidden text-foreground">
      {/* Header with Search and Export */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/20 gap-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sheet..."
            className="pl-8 h-9"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="h-9 gap-2"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export XLSX</span>
        </Button>
      </div>

      {/* Grid Content */}
      <ScrollArea className="flex-1 w-full relative">
        <div className="min-w-max p-4">
          <Table className="border bg-card">
            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, i) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "border-r font-semibold whitespace-nowrap px-4 py-2",
                        i === 0 && "w-[50px] text-center bg-muted/50",
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    No matching results.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "border-r whitespace-nowrap px-4 py-2",
                          i === 0 &&
                            "text-center text-xs text-muted-foreground bg-muted/10 font-medium",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Footer Sheet Navigation */}
      {spreadsheetData.sheets.length > 1 && (
        <div className="flex items-center gap-1 p-1 bg-muted/30 border-t overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center px-2 py-1 gap-1 border-r text-muted-foreground">
            <SheetIcon className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Sheets
            </span>
          </div>
          {spreadsheetData.sheets.map((sheet, idx) => (
            <button
              key={`${sheet.name}-${idx}`}
              onClick={() => {
                setActiveSheetIndex(idx);
                setGlobalFilter(""); // Clear filter when switching sheets
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                activeSheetIndex === idx
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {sheet.name}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={activeSheetIndex === 0}
              onClick={() =>
                setActiveSheetIndex((prev) => Math.max(0, prev - 1))
              }
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={activeSheetIndex === spreadsheetData.sheets.length - 1}
              onClick={() =>
                setActiveSheetIndex((prev) =>
                  Math.min(spreadsheetData.sheets.length - 1, prev + 1),
                )
              }
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
