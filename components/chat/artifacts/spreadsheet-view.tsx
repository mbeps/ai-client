"use client";

import { useMemo } from "react";
import * as xlsx from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface SpreadsheetViewProps {
  title: string;
  content: string; // expects JSON array of objects or CSV. We will try to parse JSON first.
}

export default function SpreadsheetView({ content }: SpreadsheetViewProps) {
  const data = useMemo(() => {
    try {
      // First try parsing as JSON
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore JSON parse errors, fallback to CSV parsing
    }

    try {
      // Try to parse as CSV
      const workbook = xlsx.read(content, { type: "string" });
      const firstSheet = workbook.SheetNames[0];
      return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
    } catch (err) {
      console.error("Failed to parse spreadsheet content:", err);
      return [];
    }
  }, [content]);

  const isAOA = data.length > 0 && Array.isArray(data[0]);

  const headers = useMemo(() => {
    if (data.length === 0) return [];
    if (isAOA) {
      // Array of Arrays: first row is headers
      return (data[0] as any[]).map(String);
    } else {
      // Array of Objects: collect all unique keys
      const keySet = new Set<string>();
      data.forEach((row: any) => {
        Object.keys(row).forEach((key) => keySet.add(key));
      });
      return Array.from(keySet);
    }
  }, [data, isAOA]);

  const rows = useMemo(() => {
    if (isAOA) {
      // Array of Arrays: skip first row (headers)
      return data.slice(1).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });
    }
    // Array of Objects: already correct
    return data;
  }, [data, isAOA, headers]);

  if (headers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>No valid spreadsheet data found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col w-full bg-background relative overflow-hidden">
      <ScrollArea className="flex-1 w-full relative">
        <div className="min-w-max p-4">
          <Table className="border bg-card">
            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r bg-muted/50 font-semibold text-xs text-muted-foreground">#</TableHead>
                {headers.map((header) => (
                  <TableHead key={header} className="border-r font-semibold whitespace-nowrap px-4 py-2">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={headers.length + 1}
                    className="text-center text-muted-foreground py-8"
                  >
                    No data rows found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="border-r text-center text-xs text-muted-foreground bg-muted/10 font-medium">
                      {i + 1}
                    </TableCell>
                    {headers.map((header) => (
                      <TableCell key={`${i}-${header}`} className="border-r whitespace-nowrap px-4 py-2">
                        {row[header] !== undefined && row[header] !== null ? String(row[header]) : ""}
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
    </div>
  );
}
