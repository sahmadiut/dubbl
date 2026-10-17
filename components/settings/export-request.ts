import { createZip } from "@/lib/import-export/zip";

const transactional = new Set(["invoices", "bills", "entries", "bank-transactions"]);
const entities = new Set(["accounts", "contacts", "products", ...transactional]);

/** Selected exports contain exactly the requested entities. All retains the server snapshot ZIP. */
export async function requestSettingsExport(input: {
  selected: string[]; all?: boolean; startDate: string; endDate: string; organizationId: string;
}, send: typeof fetch = fetch) {
  const keys = [...new Set(input.selected)];
  if (!input.all && (!keys.length || keys.some(key => !entities.has(key)))) throw new Error("Invalid export selection");
  const request = async (key: string) => {
    const params = new URLSearchParams();
    if (key === "all" || transactional.has(key)) {
      if (input.startDate) params.set("startDate", input.startDate);
      if (input.endDate) params.set("endDate", input.endDate);
    }
    const response = await send(`/api/v1/export/${key}?${params}`, { headers: { "x-organization-id": input.organizationId } });
    if (!response.ok) throw new Error("Export failed");
    return response;
  };
  if (input.all) return { blob: await (await request("all")).blob(), filename: "dubbl-export.zip" };
  if (keys.length === 1) return { blob: await (await request(keys[0])).blob(), filename: `${keys[0]}.csv` };
  const files = [];
  for (const key of keys) files.push({ name: `${key}.csv`, data: new Uint8Array(await (await request(key)).arrayBuffer()) });
  return { blob: new Blob([new Uint8Array(createZip(files))], { type: "application/zip" }), filename: "dubbl-export.zip" };
}
