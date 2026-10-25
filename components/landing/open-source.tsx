"use client";

import { useTranslations } from "next-intl";

import { motion } from "motion/react";
import { Github, Eye, Unlock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

type LandingTranslator = ReturnType<typeof useTranslations>;

/* ------------------------------------------------------------------ */
/*  Value Pillars                                                      */
/* ------------------------------------------------------------------ */

const getValues = (t: LandingTranslator) => [
  {
    icon: Eye,
    title: t("fullyTransparent"),
    description:
      t("everyLineOfCodeIsPublicAuditTheSecurity"),
  },
  {
    icon: Unlock,
    title: t("zeroLockIn"),
    description:
      t("selfHostOnYourOwnInfrastructureExportYourData"),
  },
  {
    icon: Users,
    title: t("communityDriven"),
    description:
      t("publicRoadmapOpenIssuesAndPullRequestsWelcomeBuilt"),
  },
];

/* ------------------------------------------------------------------ */
/*  Terminal Block                                                     */
/* ------------------------------------------------------------------ */

function TerminalBlock() {
  const lines = [
    { text: "$ git clone https://github.com/dubbl-org/dubbl.git", delay: 0.3 },
    { text: "$ cd dubbl && docker compose up -d", delay: 0.7 },
    { text: "", delay: 1.0 },
    { text: "  ✓ Container dubbl-db     Started", delay: 1.2, success: true },
    { text: "  ✓ Container dubbl-app    Started", delay: 1.4, success: true },
    { text: "", delay: 1.6 },
    { text: "  dubbl running at http://localhost:3000", delay: 1.8, highlight: true },
  ];

  return (
    <div className="overflow-hidden rounded-xl bg-[#0a0a0a] dark:bg-black">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="size-2.5 rounded-full bg-[#ff5f57]" />
        <div className="size-2.5 rounded-full bg-[#febc2e]" />
        <div className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] text-white/30 font-mono">terminal</span>
      </div>
      {/* Terminal body */}
      <div dir="ltr" className="overflow-x-auto whitespace-pre text-left px-5 py-4 font-mono text-[13px] leading-loose">
        {lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.3, delay: line.delay }}
            className={
              line.success
                ? "text-emerald-400"
                : line.highlight
                  ? "text-white font-medium"
                  : "text-white/60"
            }
          >
            {line.text || "\u00A0"}
          </motion.p>
        ))}
        {/* Blinking cursor */}
        <motion.span
          className="inline-block h-4 w-2 bg-emerald-400"
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function OpenSource() {
  const t = useTranslations("LandingFeatures");
  return (
    <section id="open-source" className="py-16 md:py-24">
      <Container>
        <ScrollReveal>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="p-8 md:p-10 lg:p-12">
              <SectionHeader
                badge={t("openSource")}
                title={t("forkItExtendItOwnIt")}
                subtitle={t("dubblIsFullyOpenSourceUnderTheApache2")}
                align="left"
                className="mb-8 md:mb-10"
              />

              {/* Value pillars */}
              <div className="grid gap-6 sm:grid-cols-3">
                {getValues(t).map((value, i) => (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false }}
                    transition={{
                      delay: 0.15 + i * 0.1,
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                    className="flex flex-col"
                  >
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted">
                      <value.icon className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {value.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {value.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Terminal */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
                className="mt-8"
              >
                <TerminalBlock />
              </motion.div>

              {/* CTA row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Button
                  size="lg"
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  asChild
                >
                  <a
                    href="https://github.com/dubbl-org/dubbl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="size-4" />
                    {t("viewRepository")}
                  </a>
                </Button>
                <Badge
                  variant="secondary"
                  className="border-border px-3 py-1.5 text-xs font-medium"
                >
                  {t("apache20License")}
                </Badge>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
