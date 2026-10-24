"use client";

import { useTranslations } from "next-intl";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BidiText } from "@/components/ui/bidi-text";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const t = useTranslations("SharedUI");
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertTriangle className="size-6 text-red-500" />
      </div>
      <h3 className="mt-4 text-sm font-medium">{t("somethingWentWrong")}</h3>
      <p role="alert" className="mt-1.5 min-w-0 max-w-full sm:max-w-[300px] text-xs text-muted-foreground">
        <BidiText>{message || t("failedToLoadDataPleaseCheckYourConnectionAndTryAgain")}</BidiText>
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-auto min-h-7 max-w-full whitespace-normal text-xs gap-1.5"
          onClick={onRetry}
        >
          <RefreshCw className="size-3" />
          {t("tryAgain")}
        </Button>
      )}
    </div>
  );
}
