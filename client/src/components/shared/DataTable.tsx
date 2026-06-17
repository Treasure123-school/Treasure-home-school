import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  className?: string;
  "data-testid"?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  className,
  "data-testid": testId,
}: DataTableProps<T>) {
  return (
    <div className={cn("rounded-md border", className)} data-testid={testId}>
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn("font-semibold", col.headerClassName)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={keyExtractor(row)}
              className="hover:bg-muted/20 transition-colors"
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
