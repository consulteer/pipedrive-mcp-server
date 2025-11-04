import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import all prompt registration functions
import { registerListAllDeals } from "./listAllDeals.js";
import { registerListAllPersons } from "./listAllPersons.js";
import { registerListAllPipelines } from "./listAllPipelines.js";
import { registerAnalyzeDeals } from "./analyzeDeals.js";
import { registerAnalyzeContacts } from "./analyzeContacts.js";
import { registerAnalyzeLeads } from "./analyzeLeads.js";
import { registerComparePipelines } from "./comparePipelines.js";
import { registerFindHighValueDeals } from "./findHighValueDeals.js";

/**
 * Register all MCP prompts with the server
 */
export function registerPrompts(server: McpServer): void {
  registerListAllDeals(server);
  registerListAllPersons(server);
  registerListAllPipelines(server);
  registerAnalyzeDeals(server);
  registerAnalyzeContacts(server);
  registerAnalyzeLeads(server);
  registerComparePipelines(server);
  registerFindHighValueDeals(server);
}
