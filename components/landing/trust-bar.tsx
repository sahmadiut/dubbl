"use client";

import { useTranslations } from "next-intl";

import { Container } from "@/components/shared/container";

const technologies = [
  "Next.js",
  "PostgreSQL",
  "TypeScript",
  "Drizzle ORM",
  "REST API",
  "Apache 2.0",
];

export function TrustBar() {
  const t = useTranslations("LandingShell");
  return (
    <section className="border-y border-border/50 py-8">
      <Container>
        <p className="mb-6 text-center text-sm tracking-wide text-muted-foreground">
          {t("trustedTools")}
        </p>
      </Container>
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        }}
      >
        <div dir="ltr" className="flex w-max animate-marquee items-center gap-16">
          {[...technologies, ...technologies].map((name, i) => (
            <div
              key={i}
              className="text-xl font-bold tracking-tight text-muted-foreground/30"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
