// Loaded only by the disposable integration worker. Session resolution and
// outbound email are fixture boundaries; API-key auth, memberships, roles,
// actual REST handlers, MCP registration and database writes are real.
import { register } from "node:module";
register("./organization-session-loader.mjs", import.meta.url);
