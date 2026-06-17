import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export { Select, SelectTrigger, SelectValue };

export const PortalSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContent>,
  React.ComponentPropsWithoutRef<typeof SelectContent>
>(({ className, ...props }, ref) => (
  <SelectContent
    ref={ref}
    className={cn('min-w-[var(--radix-select-trigger-width)]', className)}
    {...props}
  />
));
PortalSelectContent.displayName = 'PortalSelectContent';

interface PortalSelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectItem> {
  icon?: React.ReactNode;
  label: string;
  meta?: string;
}

export function PortalSelectItem({ icon, label, meta, className, ...props }: PortalSelectItemProps) {
  return (
    <SelectItem
      className={cn('group py-2 cursor-pointer', className)}
      {...props}
    >
      <span className="flex items-center gap-2.5">
        {icon && (
          <span className="shrink-0 text-muted-foreground group-focus:text-foreground transition-colors">
            {icon}
          </span>
        )}
        <span className="font-medium">{label}</span>
        {meta && (
          <span className="ml-auto text-xs text-muted-foreground group-focus:text-foreground/70 transition-colors pl-3">
            {meta}
          </span>
        )}
      </span>
    </SelectItem>
  );
}
