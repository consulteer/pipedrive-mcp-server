import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClients } from "../types/index.js";

// Import all tool registration functions
import { registerGetUsers } from "./getUsers.js";
import { registerGetDeals } from "./getDeals.js";
import { registerGetDeal } from "./getDeal.js";
import { registerGetDealNotes } from "./getDealNotes.js";
import { registerSearchDeals } from "./searchDeals.js";
import { registerGetPersons } from "./getPersons.js";
import { registerGetPerson } from "./getPerson.js";
import { registerSearchPersons } from "./searchPersons.js";
import { registerGetOrganizations } from "./getOrganizations.js";
import { registerGetOrganization } from "./getOrganization.js";
import { registerSearchOrganizations } from "./searchOrganizations.js";
import { registerGetPipelines } from "./getPipelines.js";
import { registerGetPipeline } from "./getPipeline.js";
import { registerGetStages } from "./getStages.js";
import { registerSearchLeads } from "./searchLeads.js";
import { registerSearchAll } from "./searchAll.js";

/**
 * Register all MCP tools with the server
 */
export function registerTools(server: McpServer, apiClients: ApiClients): void {
  registerGetUsers(server, apiClients);
  registerGetDeals(server, apiClients);
  registerGetDeal(server, apiClients);
  registerGetDealNotes(server, apiClients);
  registerSearchDeals(server, apiClients);
  registerGetPersons(server, apiClients);
  registerGetPerson(server, apiClients);
  registerSearchPersons(server, apiClients);
  registerGetOrganizations(server, apiClients);
  registerGetOrganization(server, apiClients);
  registerSearchOrganizations(server, apiClients);
  registerGetPipelines(server, apiClients);
  registerGetPipeline(server, apiClients);
  registerGetStages(server, apiClients);
  registerSearchLeads(server, apiClients);
  registerSearchAll(server, apiClients);
}
