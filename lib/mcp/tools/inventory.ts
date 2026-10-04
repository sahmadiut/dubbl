import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { z } from "zod";
import { buildAssembly } from "@/lib/api/inventory-assembly";
import { assemblyBuildSchema } from "@/lib/api/inventory-assembly-wire";

export function registerInventoryTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("build_assembly", { description: "Complete a draft/in-progress owned assembly order atomically. Consumes whole component units including wastage at exact carrying cost; receives finished stock without losing residual minor units; posts one balanced base-currency journal and audit. Returns order, journalEntryId and totalCost/unitCost/componentCost/conversionCost numeric minor amounts with *Minor strings. Safe Number range; repeated/completed/cancelled builds reject.",
    inputSchema: assemblyBuildSchema.extend({ assemblyOrderId: z.string().uuid().describe("Live owned draft/in-progress assembly order UUID") }) },
    p => wrapTool(ctx, () => buildAssembly(ctx, p.assemblyOrderId, { date: p.date })));
}
