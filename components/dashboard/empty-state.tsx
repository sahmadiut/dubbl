import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BidiText } from "@/components/ui/bidi-text";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  compact,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 px-6 text-center",
      !compact && "min-h-[50vh]"
    )}>
      <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
        <Icon className="size-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="mt-4 min-w-0 max-w-full text-sm font-medium"><BidiText>{title}</BidiText></h3>
      <p className="mt-1.5 min-w-0 max-w-full sm:max-w-sm text-sm text-muted-foreground">
        <BidiText>{description}</BidiText>
      </p>
      {children && <div className="mt-4 min-w-0 max-w-full">{children}</div>}
    </div>
  );
}
