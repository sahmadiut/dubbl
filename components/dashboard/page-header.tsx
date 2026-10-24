import { BidiText } from "@/components/ui/bidi-text";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            <BidiText>{title}</BidiText>
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground"><BidiText>{description}</BidiText></p>
          )}
        </div>
        {children && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{children}</div>}
      </div>
      <div className="h-px bg-gradient-to-r from-emerald-500/20 via-border to-transparent" />
    </div>
  );
}
