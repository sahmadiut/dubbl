/** Never adopt an error envelope as successful data, HTML or a download. */
export async function requireClientResponse(response: Response, fallback: string) {
  if (!response.ok) {
    let message = fallback;
    try {
      const body = await response.json();
      if (typeof body.error === "string") message = body.error;
    } catch { /* Non-JSON failures still have an explicit error state. */ }
    throw new Error(message);
  }
  return response;
}
export async function clientJson(response: Response, fallback: string): Promise<unknown> {
  return (await requireClientResponse(response, fallback)).json();
}
export async function clientPdf(response: Response) {
  await requireClientResponse(response, "Unable to download document");
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/pdf")) {
    throw new Error("The document response is not a PDF");
  }
  return response.blob();
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
  } finally { URL.revokeObjectURL(url); }
}
