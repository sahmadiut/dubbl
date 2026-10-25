"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useEffect, useCallback } from "react";
import { Loader2, Check, Eraser } from "lucide-react";

interface Props {
  token: string;
}

export function SignatureCanvas({ token }: Props) {
  const t = useTranslations("PublicSigning");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPosition = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const pos = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    },
    [getPosition]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const pos = getPosition(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasStrokes(true);
    },
    [isDrawing, getPosition]
  );

  const stopDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDrawing(false);
    },
    []
  );

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio
    );
    setHasStrokes(false);
    setError(null);
  }

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;

    setSubmitting(true);
    setError(null);

    try {
      const signatureDataUrl = canvas.toDataURL("image/png");

      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });

      await res.json();

      if (!res.ok) {
        setError(t("submitFailed"));
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("submitRetry"));
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div role="status" className="text-center py-6 [overflow-wrap:anywhere]">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("submittedHeading")}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("submittedDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <p id="signature-hint" className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {t("drawHint")}
      </p>

      <div className="border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <canvas
          ref={canvasRef}
          dir="ltr"
          role="img"
          aria-label={t("drawHint")}
          aria-describedby="signature-hint"
          className="w-full h-40 cursor-crosshair touch-none [unicode-bidi:isolate]"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        >
          {t("drawHint")}
        </canvas>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex min-w-0 flex-wrap gap-3 mt-4">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={submitting || !hasStrokes}
          className="flex min-w-0 items-center justify-center gap-2 whitespace-normal [overflow-wrap:anywhere] rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2.5 px-4 text-sm transition-colors"
        >
          <Eraser className="h-4 w-4 shrink-0" />
          {t("clear")}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !hasStrokes}
          className="flex-1 flex min-w-0 items-center justify-center gap-2 whitespace-normal [overflow-wrap:anywhere] rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 text-sm transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              {t("submitting")}
            </>
          ) : (
            <>
              <Check className="h-4 w-4 shrink-0" />
              {t("confirm")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
