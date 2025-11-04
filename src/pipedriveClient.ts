import {
  Configuration,
  DealsApi,
  PersonsApi,
  OrganizationsApi,
  PipelinesApi,
  ItemSearchApi,
  LeadsApi,
  NotesApi,
  UsersApi,
} from "pipedrive/v1";
import Bottleneck from "bottleneck";
import { ApiClients } from "./types/index.js";
import { ServerConfig } from "./config.js";

/**
 * Create a rate limiter for Pipedrive API calls
 */
function createRateLimiter(config: ServerConfig["pipedrive"]["rateLimit"]) {
  return new Bottleneck({
    minTime: config.minTimeMs,
    maxConcurrent: config.maxConcurrent,
  });
}

/**
 * Initialize Pipedrive API clients with rate limiting
 */
export function initializePipedriveClients(config: ServerConfig): ApiClients {
  // Create rate limiter with configuration
  const limiter = createRateLimiter(config.pipedrive.rateLimit);

  /**
   * Wraps an API client with rate limiting using a Proxy
   */
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
    apiKey: config.pipedrive.apiToken,
    basePath: `https://${config.pipedrive.domain}/api/v1`,
  });

  // Initialize and wrap API clients with rate limiting
  return {
    dealsApi: withRateLimit(new DealsApi(apiConfig)),
    personsApi: withRateLimit(new PersonsApi(apiConfig)),
    organizationsApi: withRateLimit(new OrganizationsApi(apiConfig)),
    pipelinesApi: withRateLimit(new PipelinesApi(apiConfig)),
    itemSearchApi: withRateLimit(new ItemSearchApi(apiConfig)),
    leadsApi: withRateLimit(new LeadsApi(apiConfig)),
    notesApi: withRateLimit(new NotesApi(apiConfig)),
    usersApi: withRateLimit(new UsersApi(apiConfig)),
  };
}
