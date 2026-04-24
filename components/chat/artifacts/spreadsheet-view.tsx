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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore JSON parse errors, fallback to CSV parsing
    }

    try {
      // Try to parse as CSV
      const workbook = xlsx.read(content, { type: "string" });
      const firstSheet = workbook.SheetNames[0];
      return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet]);
    } catch (err) {
      console.error("Failed to parse spreadsheet content:", err);
      return [];
    }
  }, [content]);

  const headers = useMemo(() => {
    if (data.length === 0) return [];
    // Collect all unique keys from all objects
    const keySet = new Set<string>();
    data.forEach((row: any) => {
      Object.keys(row).forEach((key) => keySet.add(key));
    });
    return Array.from(keySet);
  }, [data]);

  if (data.length === 0) {
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
              {data.map((row: any, i: number) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
