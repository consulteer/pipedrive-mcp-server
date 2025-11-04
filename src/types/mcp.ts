import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClients } from "./api.js";

/**
 * Function type for registering a tool with the MCP server
 */
export type ToolRegistration = (
  server: McpServer,
  apiClients: ApiClients
) => void;

/**
 * Function type for registering a prompt with the MCP server
 */
export type PromptRegistration = (server: McpServer) => void;
