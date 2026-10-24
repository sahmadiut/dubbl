import { cn } from "@/lib/utils";

// Decorative backgrounds must not allocate WebGL contexts or render every frame.
export function GradientBackground({ tone = "emerald" }: { tone?: "emerald" | "red" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0",
        tone === "red"
          ? "bg-[radial-gradient(ellipse_at_15%_20%,#fecaca,transparent_60%),radial-gradient(ellipse_at_85%_80%,#ef4444,transparent_65%),linear-gradient(135deg,#fca5a5,#fb7185_50%,#f87171)]"
          : "bg-[radial-gradient(ellipse_at_15%_20%,#d1fae5,transparent_60%),radial-gradient(ellipse_at_85%_80%,#10b981,transparent_65%),linear-gradient(135deg,#a7f3d0,#34d399_50%,#6ee7b7)]"
      )}
    />
  );
}
