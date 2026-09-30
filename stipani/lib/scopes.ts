// Najmanji scope dovoljan za MVP (samo čitanje kalendara).
export const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

// Priprema za fazu 2 (kreiranje/uređivanje događaja) — zasad se NE traži.
export const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const GOOGLE_SCOPES = ["openid", "email", "profile", CALENDAR_READONLY_SCOPE].join(" ");
