"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface DataTableComponentProps {
  columns: DataTableColumn[];
  data: Array<Record<string, unknown>>;
  searchable?: boolean;
  pageSize?: number;
}

type SortDirection = "asc" | "desc" | null;

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return formatCellValue(a).localeCompare(formatCellValue(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getNextSortState(
  sortKey: string | null,
  sortDir: SortDirection,
  nextKey: string,
): { sortKey: string | null; sortDir: SortDirection } {
  if (sortKey !== nextKey) {
    return { sortKey: nextKey, sortDir: "asc" };
  }
  if (sortDir === "asc") {
    return { sortKey: nextKey, sortDir: "desc" };
  }
  return { sortKey: null, sortDir: null };
}

function DataTableSearch({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
      <Input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
}

function DataTablePagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Client-side sortable, searchable, and optionally paginated table for
 * Generative UI specs, built on local Shadcn Table primitives.
 */
export function DataTableComponent({
  columns,
  data,
  searchable = false,
  pageSize,
}: DataTableComponentProps) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeData = Array.isArray(data) ? data : [];
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    if (!searchable) {
      return safeData;
    }
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return safeData;
    }
    return safeData.filter((row) =>
      safeColumns.some((col) =>
        formatCellValue(row[col.key]).toLowerCase().includes(trimmed),
      ),
    );
  }, [searchable, safeColumns, safeData, query]);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) {
      return filteredRows;
    }
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortDir, sortKey]);

  const totalPages = pageSize
    ? Math.max(1, Math.ceil(sortedRows.length / pageSize))
    : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = pageSize
    ? sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize)
    : sortedRows;

  const handleSort = (key: string) => {
    setPage(0);
    const next = getNextSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key || !sortDir) {
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
    );
  };

  return (
    <div className="space-y-3">
      {searchable && (
        <DataTableSearch
          query={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {safeColumns.map((col) => (
                <TableHead key={col.key}>
                  {col.sortable === false ? (
                    col.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="hover:text-foreground inline-flex cursor-pointer items-center font-medium"
                    >
                      {col.label}
                      {renderSortIcon(col.key)}
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, safeColumns.length)}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  {safeData.length === 0
                    ? "No data available"
                    : "No matching rows"}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {safeColumns.map((col) => (
                    <TableCell key={col.key}>
                      {formatCellValue(row[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageSize && totalPages > 1 && (
        <DataTablePagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
