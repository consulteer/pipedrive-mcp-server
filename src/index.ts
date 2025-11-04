import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";
import { loadConfig } from "./config.js";
import { registerPrompts } from "./prompts/index.js";
import { registerTools } from "./tools/index.js";
import { initializePipedriveClients } from "./pipedriveClient.js";
import { startSseServer } from "./sseServer.js";
import { startStdioServer } from "./stdioServer.js";

// Load and validate configuration
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Configuration error: ${error}`);
  process.exit(1);
}

// Initialize logger with configuration
logger.initialize(config.transport, config.logLevel);

// Initialize Pipedrive API clients
const apiClients = initializePipedriveClients(config);

const server = new McpServer({
  name: config.name,
  version: config.version,
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

// === TOOLS ===
registerTools(server, apiClients);

// === PROMPTS ===
registerPrompts(server);

// === TRANSPORT SETUP ===
if (config.transport === "sse") {
  startSseServer(server, config);
} else {
  startStdioServer(server);
}
