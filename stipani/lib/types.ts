export type Owner = "me" | "wife" | "both";
export type Viewer = "me" | "wife";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  owner: Owner;
  ownerName: string;
  calendarName: string;
  location: string | null;
  htmlLink: string | null;
  color: string;
}

export interface EventsResponse {
  events: CalendarEvent[];
  lastUpdated: string;
  warnings: string[];
  viewer: Viewer;
}
