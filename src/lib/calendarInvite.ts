/**
 * Calendar invite utilities for generating .ics files and Google Calendar links.
 */

interface ICalEventParams {
  summary: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  organizerName: string;
  organizerEmail: string;
}

/**
 * Formats a Date to iCalendar DTSTART/DTEND format: YYYYMMDDTHHmmssZ
 */
const formatICalDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
};

/**
 * Escapes special characters in iCalendar text values.
 */
const escapeICalText = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/**
 * Generates a valid iCalendar (.ics) format string for an appointment event.
 */
export function generateICalEvent(params: ICalEventParams): string {
  const { summary, description, location, startDate, endDate, organizerName, organizerEmail } = params;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Autocurb.io//Appointment//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatICalDate(startDate)}`,
    `DTEND:${formatICalDate(endDate)}`,
    `SUMMARY:${escapeICalText(summary)}`,
    `DESCRIPTION:${escapeICalText(description)}`,
    `LOCATION:${escapeICalText(location)}`,
    `ORGANIZER;CN=${escapeICalText(organizerName)}:mailto:${organizerEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Creates a Blob from iCalendar content and triggers a browser download.
 */
export function downloadCalendarInvite(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface GoogleCalendarParams {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Formats a Date for Google Calendar URL: YYYYMMDDTHHmmssZ
 */
const formatGoogleDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
};

/**
 * Generates a Google Calendar "add event" URL that opens in a new tab.
 */
export function generateGoogleCalendarUrl(params: GoogleCalendarParams): string {
  const { title, description, location, startDate, endDate } = params;

  const base = "https://calendar.google.com/calendar/render";
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: description,
    location: location,
  });

  return `${base}?${query.toString()}`;
}
