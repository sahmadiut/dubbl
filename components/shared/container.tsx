import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto min-w-0 w-full max-w-[1400px] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
