"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { BidiText } from "@/components/ui/bidi-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => Promise<void>;
}

export function useConfirm() {
  const t = useTranslations("SharedUI");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    setOptions(opts);
    setOpen(true);
    setLoading(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }

  async function handleConfirm() {
    if (options.onConfirm) {
      setLoading(true);
      try {
        await options.onConfirm();
        setOpen(false);
        resolveRef.current?.(true);
        resolveRef.current = null;
      } catch {
        setLoading(false);
      }
    } else {
      setOpen(false);
      resolveRef.current?.(true);
      resolveRef.current = null;
    }
  }

  const dialog = (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) handleCancel(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            <BidiText>{options.title || t("areYouSure")}</BidiText>
          </DialogTitle>
          {options.description && (
            <DialogDescription><BidiText>{options.description}</BidiText></DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-3 sm:flex-wrap">
          <Button type="button" className="h-auto min-h-9 whitespace-normal [overflow-wrap:anywhere]" variant="outline" disabled={loading} onClick={handleCancel}>
            <BidiText>{options.cancelLabel || t("cancel")}</BidiText>
          </Button>
          <Button
            type="button"
            className="h-auto min-h-9 whitespace-normal [overflow-wrap:anywhere]"
            variant={options.destructive ? "destructive" : "default"}
            loading={loading}
            onClick={handleConfirm}
          >
            <BidiText>{options.confirmLabel || t("confirm")}</BidiText>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
