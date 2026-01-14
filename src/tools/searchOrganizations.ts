import { z } from "zod";
import { logger } from "../logger.js";
import { ToolRegistration, getErrorMessage } from "../types/index.js";

export const registerSearchOrganizations: ToolRegistration = (
  server,
  { organizationsApi }
) => {
  server.tool(
    "search-organizations",
    "Search organizations by term",
    {
      term: z
        .string()
        .min(2, "Search term must be at least 2 characters")
        .describe("Search term for organizations"),
    },
    async ({ term }) => {
      const trimmedTerm = term.trim();

      if (trimmedTerm.length < 2) {
        const message = "Search term must be at least 2 characters";
        logger.error(message);
        return {
          content: [
            {
              type: "text",
              text: `Error searching organizations: ${message}`,
            },
          ],
          isError: true,
        };
      }

      try {
        // @ts-ignore - API method exists but TypeScript definition is wrong
        const response = await (organizationsApi as any).searchOrganization({
          term: trimmedTerm,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(
          `Error searching organizations with term "${term}":`,
          error
        );
        return {
          content: [
            {
              type: "text",
              text: `Error searching organizations: ${getErrorMessage(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
