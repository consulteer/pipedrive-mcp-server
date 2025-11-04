import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DealsApi,
  PersonsApi,
  OrganizationsApi,
  PipelinesApi,
  ItemSearchApi,
  LeadsApi,
  NotesApi,
  UsersApi,
} from "pipedrive/v1";

/**
 * API clients used by tools
 */
export interface ApiClients {
  dealsApi: DealsApi;
  personsApi: PersonsApi;
  organizationsApi: OrganizationsApi;
  pipelinesApi: PipelinesApi;
  itemSearchApi: ItemSearchApi;
  leadsApi: LeadsApi;
  notesApi: NotesApi;
  usersApi: UsersApi;
}

/**
 * Tool registration function type
 */
export type ToolRegistration = (
  server: McpServer,
  apiClients: ApiClients
) => void;

/**
 * Error handling utilities
 */
export interface ErrorWithMessage {
  message: string;
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}
