import { BidiText } from "@/components/ui/bidi-text";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
      <div className="min-w-0">
        <p className="text-sm font-medium"><BidiText>{title}</BidiText></p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground"><BidiText>{description}</BidiText></p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
