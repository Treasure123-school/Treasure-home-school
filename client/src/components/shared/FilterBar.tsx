import type { ReactNode } from "react";
import { SearchInput } from "./SearchInput";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
  children?: ReactNode;
  "data-testid"?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  className,
  children,
  "data-testid": testId,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-3", className)}>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="flex-1"
        data-testid={testId}
      />
      {children}
    </div>
  );
}
