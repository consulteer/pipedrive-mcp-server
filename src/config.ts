import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { LogLevel } from "./logger.js";
import packageJson from "../package.json" with { type: "json" };

// Load environment variables
dotenv.config();

/**
 * Server configuration
 */
export interface ServerConfig {
  // Server metadata
  name: string;
  version: string;

  // Transport settings
  transport: "stdio" | "sse";
  logLevel: LogLevel;

  // Pipedrive API settings
  pipedrive: {
    apiToken: string;
    domain: string;
    rateLimit: {
      minTimeMs: number;
      maxConcurrent: number;
    };
  };

  // SSE transport settings (optional)
  sse?: {
    port: number;
    endpoint: string;
    ngrok?: {
      enabled: boolean;
      authtoken?: string;
    };
  };

  // JWT authentication settings (optional)
  jwt?: {
    secret: string;
    token: string;
    algorithm: jwt.Algorithm;
    verifyOptions: {
      algorithms: jwt.Algorithm[];
      audience?: string;
      issuer?: string;
    };
  };
}

/**
 * Validate and load configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  // Required Pipedrive settings
  const pipedriveApiToken = process.env.PIPEDRIVE_API_TOKEN;
  if (!pipedriveApiToken) {
    throw new Error("PIPEDRIVE_API_TOKEN environment variable is required");
  }

  const pipedriveDomain = process.env.PIPEDRIVE_DOMAIN;
  if (!pipedriveDomain) {
    throw new Error(
      "PIPEDRIVE_DOMAIN environment variable is required (e.g., 'ukkofi.pipedrive.com')"
    );
  }

  // Transport settings
  const transportType = (process.env.MCP_TRANSPORT || "stdio") as
    | "stdio"
    | "sse";
  const logLevel = process.env.LOG_LEVEL
    ? parseInt(process.env.LOG_LEVEL)
    : LogLevel.INFO;

  // Base configuration
  const config: ServerConfig = {
    name: "pipedrive-mcp-server",
    version: packageJson.version,
    transport: transportType,
    logLevel,
    pipedrive: {
      apiToken: pipedriveApiToken,
      domain: pipedriveDomain,
      rateLimit: {
        minTimeMs: Number(process.env.PIPEDRIVE_RATE_LIMIT_MIN_TIME_MS || 250),
        maxConcurrent: Number(
          process.env.PIPEDRIVE_RATE_LIMIT_MAX_CONCURRENT || 2
        ),
      },
    },
  };

  // SSE-specific configuration
  if (transportType === "sse") {
    config.sse = {
      port: parseInt(process.env.MCP_PORT || "3000", 10),
      endpoint: process.env.MCP_ENDPOINT || "/message",
    };

    // ngrok configuration
    const ngrokEnabled = process.env.MCP_NGROK_ENABLED === "true";
    if (ngrokEnabled) {
      config.sse.ngrok = {
        enabled: true,
        authtoken: process.env.MCP_NGROK_AUTHTOKEN,
      };
    }
  }

  // JWT authentication configuration
  const jwtSecret = process.env.MCP_JWT_SECRET;
  if (jwtSecret) {
    const jwtToken = process.env.MCP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error(
        "MCP_JWT_TOKEN environment variable is required when MCP_JWT_SECRET is set"
      );
    }

    const jwtAlgorithm = (process.env.MCP_JWT_ALGORITHM ||
      "HS256") as jwt.Algorithm;
    const jwtVerifyOptions = {
      algorithms: [jwtAlgorithm] as jwt.Algorithm[],
      audience: process.env.MCP_JWT_AUDIENCE,
      issuer: process.env.MCP_JWT_ISSUER,
    };

    // Verify the boot token
    try {
      jwt.verify(jwtToken, jwtSecret, jwtVerifyOptions);
    } catch (error) {
      throw new Error(`Failed to verify MCP_JWT_TOKEN: ${error}`);
    }

    config.jwt = {
      secret: jwtSecret,
      token: jwtToken,
      algorithm: jwtAlgorithm,
      verifyOptions: jwtVerifyOptions,
    };
  }

  return config;
}
