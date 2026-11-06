"use client";

import { flexRender } from "@tanstack/react-table";
import {
  legacyCreateColumnHelper as createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Sheet as SheetIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as xlsx from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import type { ArtifactSheet } from "@/types/artifact/artifact-sheet";
import type { ArtifactSpreadsheetData } from "@/types/artifact/artifact-spreadsheet-data";
import type { CellObject } from "@/types/artifact/cell-object";
import type { CellStyle } from "@/types/artifact/cell-style";

/**
 * Props for SpreadsheetView artifact component.
 * Accepts either JSON-formatted spreadsheet data or CSV content.
 *
 * @author Maruf Bepary
 */
interface SpreadsheetViewProps {
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

      // If parsed was an object or primitive without sheets or array,
      // it is invalid JSON spreadsheet data and should not fall through to CSV.
      return { sheets: [] };
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
      logger.error("Failed to parse spreadsheet content", err);
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
export function SpreadsheetView({ title, content }: SpreadsheetViewProps) {
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
      const headerRow = (activeSheet.data[0] as any[]) || [];
      const dataRows = activeSheet.data.slice(1);

      // Determine max columns across header row and all data rows
      let colCount = headerRow.length;
      for (const row of dataRows) {
        if (Array.isArray(row) && row.length > colCount) {
          colCount = row.length;
        }
      }

      if (colCount === 0) return { headers: [], rows: [] };

      const headers: { id: string; title: string }[] = [];
      for (let i = 0; i < colCount; i++) {
        const cell = headerRow[i];
        const val =
          cell && typeof cell === "object" && "v" in cell ? cell.v : cell;
        const strVal = val != null ? String(val).trim() : "";
        headers.push({
          id: `col_${i}`,
          title: strVal || `Column ${i + 1}`,
        });
      }

      const rows = dataRows.map((row) => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < colCount; i++) {
          obj[`col_${i}`] = Array.isArray(row) ? row[i] : undefined;
        }
        return obj;
      });

      return { headers, rows };
    } else {
      // Array of Objects
      const keySet = new Set<string>();
      activeSheet.data.forEach((row: any) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((key) => {
            keySet.add(key);
          });
        }
      });
      const keys = Array.from(keySet);
      if (keys.length === 0) return { headers: [], rows: [] };

      const headers = keys.map((key, i) => {
        const strVal = key.trim();
        return {
          id: `col_${i}`,
          title: strVal || `Column ${i + 1}`,
          key,
        };
      });

      const rows = activeSheet.data.map((row: any) => {
        const obj: Record<string, any> = {};
        headers.forEach((h) => {
          obj[h.id] = row && typeof row === "object" ? row[h.key] : undefined;
        });
        return obj;
      });

      return { headers, rows };
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
        columnHelper.accessor(header.id, {
          id: header.id,
          header: header.title,
          cell: (info) => {
            const val = info.getValue();
            if (val && typeof val === "object" && "v" in val) {
              const cellObj = val as CellObject;
              const { styles, classes } = getCellStyle(cellObj.s);
              return (
                <div
                  style={styles}
                  className={cn("rounded px-1 py-0.5", classes)}
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
        const isSheetAOA =
          sheet.data.length > 0 && Array.isArray(sheet.data[0]);
        let worksheet: xlsx.WorkSheet;

        if (isSheetAOA) {
          const flatData = sheet.data.map((row) =>
            Array.isArray(row)
              ? row.map((cell) =>
                  cell && typeof cell === "object" && "v" in cell
                    ? cell.v
                    : cell,
                )
              : [],
          );
          worksheet = xlsx.utils.aoa_to_sheet(flatData);
        } else {
          worksheet = xlsx.utils.json_to_sheet(sheet.data);
        }

        xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name);
      });
      const safeTitle = (title || "spreadsheet")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      xlsx.writeFile(workbook, `${safeTitle}.xlsx`);
    } catch (err) {
      logger.error("Failed to export workbook", err);
    }
  };

  const hasAnyData = spreadsheetData.sheets.some(
    (sheet) => Array.isArray(sheet.data) && sheet.data.length > 0,
  );

  if (!hasAnyData) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <h3 className="text-foreground text-sm font-semibold">
          Empty Spreadsheet
        </h3>
        <p className="text-xs">
          No rows or valid sheet data found in this spreadsheet artifact.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden">
      {/* Header with Search and Export */}
      <div className="bg-muted/20 flex shrink-0 items-center justify-between gap-2 border-b p-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search sheet..."
            className="h-9 pl-8"
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
      {activeSheet.data.length === 0 || headers.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium">This sheet contains no data.</p>
        </div>
      ) : (
        <ScrollArea className="relative w-full flex-1">
          <div className="min-w-max p-4">
            <Table className="bg-card border">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, i) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "border-r px-4 py-2 font-semibold whitespace-nowrap",
                          i === 0 && "bg-muted/50 w-[50px] text-center",
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
                      className="text-muted-foreground py-8 text-center"
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
                            "border-r px-4 py-2 whitespace-nowrap",
                            i === 0 &&
                              "bg-muted/10 text-muted-foreground text-center text-xs font-medium",
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
      )}

      {/* Footer Sheet Navigation */}
      {spreadsheetData.sheets.length > 1 && (
        <div className="no-scrollbar bg-muted/30 flex shrink-0 items-center gap-1 overflow-x-auto border-t p-1">
          <div className="text-muted-foreground flex items-center gap-1 border-r px-2 py-1">
            <SheetIcon className="h-3 w-3" />
            <span className="text-[10px] font-bold tracking-wider uppercase">
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
                "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                activeSheetIndex === idx
                  ? "bg-background text-foreground ring-border shadow-sm ring-1"
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
