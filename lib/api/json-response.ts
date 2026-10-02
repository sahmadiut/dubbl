import { NextResponse } from "next/server";
import { stringifyWire, type WireRepresentation } from "../money/wire";

/** Legacy numeric by default; exact mode belongs only to an explicitly documented contract. */
export function jsonResponse(
  data: unknown,
  init?: ResponseInit,
  representation: WireRepresentation = "legacy",
) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new NextResponse(stringifyWire(data, representation), { ...init, headers });
}
