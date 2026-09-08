import { addDaysToISO, getLocalDateISO } from "@/lib/app-time";

const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function todayIso() {
  return getLocalDateISO();
}

export function tomorrowIso() {
  return addDaysToISO(todayIso(), 1);
}

export function formatReceptionistDate(value = todayIso()) {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return value;

  return displayDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export function parseReceptionistDate(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  const displayMatch = value.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (displayMatch) {
    const months: Record<string, string> = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const day = displayMatch[1].padStart(2, "0");
    const month = months[displayMatch[2].toLowerCase()];
    if (month) return `${displayMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return getLocalDateISO(parsed);

  return todayIso();
}

export function parseReceptionistTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatReceptionistTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function nextBookableReceptionistTime(now = new Date(), minuteStep = 15) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const step = Math.max(1, minuteStep);
  const nextSlot = Math.ceil((currentMinutes + 1) / step) * step;

  return formatReceptionistTime(Math.min(nextSlot, 23 * 60 + 59));
}

export function isPastReceptionistAppointment(dateValue: string, timeValue: string, now = new Date()) {
  const appointmentDate = parseReceptionistDate(dateValue);
  const currentDate = getLocalDateISO(now);

  if (appointmentDate < currentDate) return true;
  if (appointmentDate > currentDate) return false;

  const appointmentMinutes = parseReceptionistTime(timeValue);
  if (appointmentMinutes === null) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return appointmentMinutes <= currentMinutes;
}
