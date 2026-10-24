import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { BidiText } from "@/components/ui/bidi-text";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  sparklineData?: number[];
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} className="h-6 w-20 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-emerald-500"
      />
    </svg>
  );
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  sparklineData,
}: StatCardProps) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          <BidiText>{title}</BidiText>
        </p>
        <Icon className="size-4 shrink-0 text-muted-foreground/50" />
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 max-w-full space-y-1">
          <p className="text-lg sm:text-[24px] font-bold tracking-tight font-mono tabular-nums">
            <BidiText>{value}</BidiText>
          </p>
          {change && (
            <p
              className={cn(
                "text-xs font-medium",
                changeType === "positive" && "text-emerald-600 dark:text-emerald-400",
                changeType === "negative" && "text-red-600 dark:text-red-400",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              <BidiText>{change}</BidiText>
            </p>
          )}
        </div>
        {sparklineData && <Sparkline data={sparklineData} />}
      </div>
    </div>
  );
}
