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
 * Collection of Pipedrive API client instances used throughout the application
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
