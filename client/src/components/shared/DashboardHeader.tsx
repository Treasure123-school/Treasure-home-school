import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WelcomeCard } from "./WelcomeCard";

interface DashboardHeaderProps {
  name: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  "data-testid"?: string;
}

/**
 * Thin wrapper around WelcomeCard that keeps the existing DashboardHeader API
 * intact for Admin and Teacher dashboards while delegating all responsive
 * logic to the shared WelcomeCard component.
 */
export function DashboardHeader({
  name,
  subtitle,
  icon,
  className,
  "data-testid": testId,
}: DashboardHeaderProps) {
  return (
    <WelcomeCard
      name={name}
      subtitle={subtitle}
      icon={icon}
      showDate
      className={cn("mb-6", className)}
      data-testid={testId}
    />
  );
}
