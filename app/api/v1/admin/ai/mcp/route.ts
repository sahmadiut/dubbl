import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getSiteSessionContext } from "@/lib/api/require-site-admin";
import { handleError } from "@/lib/api/response";
import { createSiteMcpServer } from "@/lib/mcp/server";

/** Stateless, same-origin, cookie-session MCP. No OAuth/org credential upgrade. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
    const ctx = await getSiteSessionContext(request);
    const server = createSiteMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      // JSON transport fully materializes each read result before returning.
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } finally {
      await transport.close();
      await server.close();
    }
  } catch (err) { return handleError(err); }
}
