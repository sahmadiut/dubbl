import * as React from "react"

import { cn } from "@/lib/utils"

/** Isolate a caller's mixed-script text without changing its copyable value. */
function BidiText({ className, dir = "auto", ...props }: React.ComponentProps<"bdi">) {
  return (
    <bdi
      data-slot="bidi-text"
      dir={dir}
      className={cn("[unicode-bidi:isolate] [overflow-wrap:anywhere]", className)}
      {...props}
    />
  )
}

/** Email, URLs, IBANs, keys and document identifiers keep their logical order. */
function IdentifierText({ className, dir = "ltr", ...props }: React.ComponentProps<"bdi">) {
  return (
    <BidiText
      data-slot="identifier-text"
      dir={dir}
      className={cn("font-mono tabular-nums select-text whitespace-pre-wrap", className)}
      {...props}
    />
  )
}

export { BidiText, IdentifierText }
