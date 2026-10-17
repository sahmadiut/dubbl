import type { ReactNode } from "react";

// Catalogs may choose only these structural tags. Attributes, URLs and HTML
// always belong in reviewed application code, never in translated strings.
export const richTextTags = {
  strong: (children: ReactNode) => <strong>{children}</strong>,
  em: (children: ReactNode) => <em>{children}</em>,
  code: (children: ReactNode) => <code>{children}</code>,
};
