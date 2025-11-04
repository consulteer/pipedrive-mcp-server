# Pipedrive MCP Server - AI Coding Agent Instructions

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that exposes Pipedrive CRM data to LLM applications. The architecture consists of:

- **Single-file server** (`src/index.ts`, 1084 lines) - all MCP tools, prompts, and transport logic in one place
- **Dual transport modes**: stdio (local CLI) and SSE (HTTP server for remote access)
- **Rate-limited Pipedrive API wrapper** using Bottleneck proxy pattern
- **Optional JWT authentication** for SSE transport

## Critical Development Workflows

### Running & Debugging

```bash
# Development (TypeScript source with tsx loader)
npm run dev

# Production build
npm run build && npm start

# Debug configurations available in .vscode/launch.json:
# - "Debug MCP Server (HTTP/SSE)" - Debug with SSE transport on port 3000
# - "Debug MCP Server (stdio)" - Debug with stdio transport
# - "Debug Built Server (HTTP/SSE)" - Debug compiled JS (runs build first)
```

### Environment Setup

Required `.env` variables:

```bash
PIPEDRIVE_API_TOKEN=your_token
PIPEDRIVE_DOMAIN=company.pipedrive.com  # No https://, just domain

# Optional - SSE transport (default: stdio)
MCP_TRANSPORT=sse
MCP_PORT=3000

# Optional - JWT auth for SSE
MCP_JWT_SECRET=secret
MCP_JWT_TOKEN=token_value
MCP_JWT_ALGORITHM=HS256

# Optional - ngrok tunnel (requires MCP_TRANSPORT=sse)
MCP_NGROK_ENABLED=true
MCP_NGROK_AUTHTOKEN=your_ngrok_token
```

### Docker Deployment

Multi-stage build uses **Node 22 Alpine**. Key points:

- Builder stage: installs all deps, compiles TypeScript
- Production stage: only production deps, runs as non-root `node` user
- Health check at `/health`, SSE endpoint at `/sse`, message POST at `/message`
- GitHub Actions workflow (`.github/workflows/docker-build.yml`) builds multi-arch images (amd64/arm64) on tag push

## Project-Specific Conventions

### Rate Limiting Pattern

All Pipedrive API clients are wrapped with a Bottleneck proxy in `src/index.ts`:

```typescript
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

const dealsApi = withRateLimit(new pipedrive.DealsApi(apiClient));
```

**Why**: Prevents Pipedrive API rate limit violations. Default: 250ms between calls, max 2 concurrent requests.

### Tool Definition Pattern

All MCP tools follow this structure in `src/index.ts`:

```typescript
server.tool(
  "tool-name",
  "Description for LLM",
  {
    /* zod schema for parameters */
  },
  async (params) => {
    try {
      // API call logic
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${getErrorMessage(error)}` }],
        isError: true,
      };
    }
  }
);
```

**All responses are JSON-stringified text**, not structured objects. Error handling uses custom `getErrorMessage()` helper for type-safe error extraction.

### Transport Selection Logic

Transport determined at startup (line 964-1084):

```typescript
const transportType = process.env.MCP_TRANSPORT || "stdio";

if (transportType === "sse") {
  // HTTP server with /sse (GET) and /message (POST) endpoints
  // JWT verification on all requests if MCP_JWT_SECRET set
  // Maintains Map<sessionId, SSEServerTransport>
} else {
  // stdio - direct stdin/stdout communication
}
```

**Why two transports**: stdio for local development/Claude Desktop, SSE for Dockerized deployments accessible over HTTP.

### TypeScript Configuration

- **Module**: `Node16` with `moduleResolution: Node16` - enables `.js` extensions in imports (required by MCP SDK)
- **Target**: `ES2022` - uses native top-level await
- **Type**: `"module"` in package.json - ES modules only
- **Strict mode enabled** but uses `@ts-ignore` for incomplete Pipedrive SDK types (lines 132, 136, 138, 223, 264)

### API Client Initialization

Pipedrive client requires custom domain setup (lines 106-118):

```typescript
const apiClient = new pipedrive.ApiClient();
apiClient.basePath = `https://${process.env.PIPEDRIVE_DOMAIN}/api/v1`;
apiClient.authentications["api_key"] = {
  type: "apiKey",
  in: "query",
  name: "api_token",
  apiKey: process.env.PIPEDRIVE_API_TOKEN,
};
```

**Do not** use default Pipedrive client instantiation - it won't respect custom domains (subdomains vary per customer).

## Key Tools Implemented

16 tools total, notable patterns:

- **`get-users`** - Always call BEFORE filtering by owner_id (returns user ID mapping)
- **`get-deals`** - Complex filtering: supports search by title (uses search API) OR date-based filtering (uses list API) + client-side filters for value ranges
- **`search-*`** tools - Use ItemSearchApi for cross-entity searching
- All tools return **full object dumps** including custom fields (Pipedrive extends base schemas per customer)

## Common Pitfalls

1. **Don't add import extensions manually** - TypeScript will error. Use `.js` for imports of `.ts` files (Node16 module resolution requirement)
2. **JWT validation runs at startup** - If `MCP_JWT_SECRET` set, `MCP_JWT_TOKEN` must be valid or server exits
3. **Pipedrive SDK types are incomplete** - Expect `@ts-ignore` for newer APIs (Activities, Notes, Users)
4. **Client-side filtering is intentional** - API filters are limited; tools combine API + manual filtering for flexibility
5. **Bottleneck proxy breaks instanceof checks** - Proxied clients aren't instances of original class

## Testing Approach

No automated tests currently. Manual testing workflow:

1. Start with stdio: `npm run dev` (test with Claude Desktop or MCP inspector)
2. Test SSE mode: Set `MCP_TRANSPORT=sse` and use curl/Postman against `/sse` and `/message`
3. Docker testing: `docker-compose up` and verify health endpoint

## Dependencies Update Strategy

- **Node.js**: Currently on v22 LTS (`.devcontainer/devcontainer.json`, `Dockerfile`, `package.json` engines field)
- **Key deps**: `@modelcontextprotocol/sdk`, `pipedrive`, `zod`, `bottleneck`
- Update with `npm outdated` then manually bump versions in `package.json`
- Major version updates of `pipedrive` SDK may require new `@ts-ignore` annotations
