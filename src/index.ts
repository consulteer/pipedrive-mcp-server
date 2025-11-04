import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  Configuration,
  DealsApi,
  PersonsApi,
  OrganizationsApi,
  PipelinesApi,
  ItemSearchApi,
  LeadsApi,
  ActivitiesApi,
  NotesApi,
  UsersApi,
} from "pipedrive/v1";
import * as dotenv from "dotenv";
import Bottleneck from "bottleneck";
import jwt from "jsonwebtoken";
import http from "http";
import ngrok from "@ngrok/ngrok";
import { logger, LogLevel } from "./logger.js";
import { registerPrompts } from "./prompts/index.js";
import { registerTools } from "./tools/index.js";
import { getErrorMessage } from "./types/index.js";

// Load environment variables
dotenv.config();

// Initialize logger early (will be re-initialized with transport type later)
const transportType = (process.env.MCP_TRANSPORT || "stdio") as "stdio" | "sse";
const logLevel = process.env.LOG_LEVEL
  ? parseInt(process.env.LOG_LEVEL)
  : LogLevel.INFO;
logger.initialize(transportType, logLevel);

// Check for required environment variables
if (!process.env.PIPEDRIVE_API_TOKEN) {
  logger.error("PIPEDRIVE_API_TOKEN environment variable is required");
  process.exit(1);
}

if (!process.env.PIPEDRIVE_DOMAIN) {
  logger.error(
    "PIPEDRIVE_DOMAIN environment variable is required (e.g., 'ukkofi.pipedrive.com')"
  );
  process.exit(1);
}

const jwtSecret = process.env.MCP_JWT_SECRET;
const jwtAlgorithm = (process.env.MCP_JWT_ALGORITHM ||
  "HS256") as jwt.Algorithm;
const jwtVerifyOptions = {
  algorithms: [jwtAlgorithm],
  audience: process.env.MCP_JWT_AUDIENCE,
  issuer: process.env.MCP_JWT_ISSUER,
};

if (jwtSecret) {
  const bootToken = process.env.MCP_JWT_TOKEN;
  if (!bootToken) {
    logger.error(
      "MCP_JWT_TOKEN environment variable is required when MCP_JWT_SECRET is set"
    );
    process.exit(1);
  }

  try {
    jwt.verify(bootToken, jwtSecret, jwtVerifyOptions);
  } catch (error) {
    logger.error("Failed to verify MCP_JWT_TOKEN", error);
    process.exit(1);
  }
}

const verifyRequestAuthentication = (req: http.IncomingMessage) => {
  if (!jwtSecret) {
    return { ok: true } as const;
  }

  const header = req.headers["authorization"];
  if (!header) {
    return {
      ok: false,
      status: 401,
      message: "Missing Authorization header",
    } as const;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return {
      ok: false,
      status: 401,
      message: "Invalid Authorization header format",
    } as const;
  }

  try {
    jwt.verify(token, jwtSecret, jwtVerifyOptions);
    return { ok: true } as const;
  } catch (_error) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired token",
    } as const;
  }
};

const limiter = new Bottleneck({
  minTime: Number(process.env.PIPEDRIVE_RATE_LIMIT_MIN_TIME_MS || 250),
  maxConcurrent: Number(process.env.PIPEDRIVE_RATE_LIMIT_MAX_CONCURRENT || 2),
});

const withRateLimit = <T extends object>(client: T): T => {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) =>
          limiter.schedule(() => (value as Function).apply(target, args));
      }
      return value;
    },
  });
};

// Initialize Pipedrive API configuration with API token and custom domain
const apiConfig = new Configuration({
  apiKey: process.env.PIPEDRIVE_API_TOKEN,
  basePath: `https://${process.env.PIPEDRIVE_DOMAIN}/api/v1`,
});

// Initialize Pipedrive API clients
const dealsApi = withRateLimit(new DealsApi(apiConfig));
const personsApi = withRateLimit(new PersonsApi(apiConfig));
const organizationsApi = withRateLimit(new OrganizationsApi(apiConfig));
const pipelinesApi = withRateLimit(new PipelinesApi(apiConfig));
const itemSearchApi = withRateLimit(new ItemSearchApi(apiConfig));
const leadsApi = withRateLimit(new LeadsApi(apiConfig));
const _activitiesApi = withRateLimit(new ActivitiesApi(apiConfig));
const notesApi = withRateLimit(new NotesApi(apiConfig));
const usersApi = withRateLimit(new UsersApi(apiConfig));

// Create MCP server
const server = new McpServer({
  name: "pipedrive-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

// === TOOLS ===
registerTools(server, {
  dealsApi,
  personsApi,
  organizationsApi,
  pipelinesApi,
  itemSearchApi,
  leadsApi,
  notesApi,
  usersApi,
});

// === PROMPTS ===
registerPrompts(server);

// === TRANSPORT SETUP ===
// Transport type already defined at the top of the file
if (transportType === "sse") {
  // SSE transport - create HTTP server
  const port = parseInt(process.env.MCP_PORT || "3000", 10);
  const endpoint = process.env.MCP_ENDPOINT || "/message";

  // Store active transports by session ID
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Session-Id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/sse") {
      const authResult = verifyRequestAuthentication(req);
      if (!authResult.ok) {
        res.writeHead(authResult.status, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ error: authResult.message }));
        return;
      }

      // Establish SSE connection
      logger.debug("New SSE connection request");
      const transport = new SSEServerTransport(endpoint, res);

      // Store transport by session ID
      transports.set(transport.sessionId, transport);

      transport.onclose = () => {
        logger.info(`SSE connection closed: ${transport.sessionId}`);
        transports.delete(transport.sessionId);
      };

      try {
        await server.connect(transport);
        logger.info(`SSE connection established: ${transport.sessionId}`);
      } catch (err) {
        logger.error("Failed to establish SSE connection:", err);
        transports.delete(transport.sessionId);
      }
    } else if (req.method === "POST" && url.pathname === endpoint) {
      const authResult = verifyRequestAuthentication(req);
      if (!authResult.ok) {
        res.writeHead(authResult.status, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ error: authResult.message }));
        return;
      }

      // Handle incoming message
      const sessionId =
        url.searchParams.get("sessionId") ||
        (req.headers["x-session-id"] as string);

      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId" }));
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      req.on("error", (err) => {
        logger.error("Error receiving POST message body:", err);
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request body" }));
        }
      });

      try {
        await transport.handlePostMessage(req, res);
      } catch (err) {
        logger.error("Error handling POST message:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
    } else {
      // Health check endpoint
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", transport: "sse" }));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    }
  });

  httpServer.listen(port, async () => {
    logger.info(`Pipedrive MCP Server (SSE) listening on port ${port}`);
    logger.info(`SSE endpoint: http://localhost:${port}/sse`);
    logger.info(`Message endpoint: http://localhost:${port}${endpoint}`);

    // Check if ngrok is enabled
    const ngrokEnabled = process.env.MCP_NGROK_ENABLED === "true";
    const ngrokAuthtoken = process.env.MCP_NGROK_AUTHTOKEN;

    if (ngrokEnabled) {
      if (!ngrokAuthtoken) {
        logger.warn(
          "WARNING: MCP_NGROK_ENABLED is true but MCP_NGROK_AUTHTOKEN is not set. Skipping ngrok tunnel."
        );
      } else {
        try {
          // Establish ngrok tunnel
          const listener = await ngrok.connect({
            addr: port,
            authtoken: ngrokAuthtoken,
          });

          const ngrokUrl = listener.url();
          logger.info("");
          logger.info("=".repeat(60));
          logger.info("🌐 ngrok tunnel established!");
          logger.info(`Public URL: ${ngrokUrl}`);
          logger.info(`SSE endpoint: ${ngrokUrl}/sse`);
          logger.info(`Message endpoint: ${ngrokUrl}${endpoint}`);
          logger.info(`Health check: ${ngrokUrl}/health`);
          logger.info("=".repeat(60));
          logger.info("");
        } catch (error) {
          logger.error(
            "ERROR: Failed to establish ngrok tunnel:",
            getErrorMessage(error)
          );
          logger.warn("Server will continue running on local port only.");
        }
      }
    }
  });
} else {
  // Default: stdio transport
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    logger.error("Failed to start MCP server:", err);
    process.exit(1);
  });

  logger.info("Pipedrive MCP Server started (stdio transport)");
}
