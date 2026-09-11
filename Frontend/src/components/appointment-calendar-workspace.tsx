"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Printer,
  Search,
  Settings,
  UserRound,
  Video,
} from "lucide-react";
import { Avatar, Field, Modal, Skeleton, TimePicker } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { CURRENT_DATE_ISO, getLocalDateISO } from "@/lib/app-time";
import { Appointment, AppointmentType, ClinicLocation, Doctor, Patient } from "@/lib/types";
import { DoctorShift } from "@/lib/doctor-workflow-types";
import {
  createBackendAppointment,
  deleteBackendAppointment,
  getBackendBootstrap,
  updateBackendAppointment,
} from "@/lib/api-client";
import { ConsultationForm } from "@/components/doctor-consultation-form";

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const viewOptions = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
] as const;

type CalendarViewMode = (typeof viewOptions)[number]["value"];
type CalendarSettingsPanel = "calendarTiming" | "staffNotifications" | "visitTiming" | "patientNotifications" | null;
const settingsPanelTitles: Record<Exclude<CalendarSettingsPanel, null>, string> = {
  calendarTiming: "Calendar Timings",
  staffNotifications: "Doctor & Staff Notifications",
  visitTiming: "Doctor Visit Timings",
  patientNotifications: "Patient Notifications",
};

function dateAtNoon(date: string) {
  return new Date(`${date}T12:00:00`);
}

function isoDate(date: Date) {
  return getLocalDateISO(date);
}

function addDays(date: string, days: number) {
  const next = dateAtNoon(date);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}

function addMonths(date: string, months: number) {
  const current = dateAtNoon(date);
  const next = new Date(current.getFullYear(), current.getMonth() + months, 1, 12);
  return isoDate(next);
}

function formatDayHeader(date: string) {
  const value = dateAtNoon(date);
  return `${dayFormatter.format(value).toUpperCase()} ${value.getDate()} ${monthFormatter.format(value).toUpperCase()}`;
}

function formatDateLabel(date: string) {
  const value = dateAtNoon(date);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(dateAtNoon(date));
}

function getMonthDates(date: string) {
  const current = dateAtNoon(date);
  const firstDay = new Date(current.getFullYear(), current.getMonth(), 1, 12);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(gridStart);
    next.setDate(gridStart.getDate() + index);
    return isoDate(next);
  });
}

function timeToMinutes(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridian = match[3].toUpperCase();
  let hours = rawHours % 12;
  if (meridian === "PM") hours += 12;
  return hours * 60 + minutes;
}

function clockTimeToMinutes(time: string) {
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }
  return timeToMinutes(time);
}

function minutesToTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toNativeTime(value: string) {
  const totalMinutes = timeToMinutes(value);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function fromNativeTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  return minutesToTime(hours * 60 + minutes);
}

function formatAppointmentSaveError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("available doctor shift")) {
    return "This time is outside the doctor's available shift. Choose an earlier time, or extend the shift so it ends after the appointment.";
  }
  if (normalized.includes("already booked")) {
    return "The doctor is already booked for this time. Choose another available slot.";
  }
  return message;
}

function durationRows(duration: number, slotInterval: number) {
  return Math.max(1, Math.ceil(duration / slotInterval));
}

export function AppointmentCalendarWorkspace() {
  const { selectedWorkplaceId, workContext } = useMode();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentPatients, setAppointmentPatients] = useState<Patient[]>([]);
  const [appointmentDoctors, setAppointmentDoctors] = useState<Doctor[]>([]);
  const [appointmentLocations, setAppointmentLocations] = useState<ClinicLocation[]>([]);
  const [appointmentShifts, setAppointmentShifts] = useState<DoctorShift[]>([]);
  const [backendWorkplaceId, setBackendWorkplaceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(CURRENT_DATE_ISO);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [showForm, setShowForm] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<CalendarSettingsPanel>(null);
  const [modernTheme, setModernTheme] = useState(true);
  const [showCancelled, setShowCancelled] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<Appointment | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const [appointmentFormError, setAppointmentFormError] = useState("");
  const [calendarSettings, setCalendarSettings] = useState({
    calendarStartTime: "8:00 AM",
    calendarEndTime: "6:00 PM",
    slotInterval: "15",
    visitStartTime: "9:00 AM",
    visitEndTime: "5:00 PM",
    staffSms: true,
    staffEmail: true,
    staffReminders: true,
    patientSms: true,
    patientEmail: true,
    patientReminderHours: "24",
  });
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    locationId: "",
    date: CURRENT_DATE_ISO,
    time: "09:00 AM",
    durationMins: "20",
    type: "In-Person" as AppointmentType,
    reason: "",
  });

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap({ workplaceId: selectedWorkplaceId })
      .then((data) => {
        if (cancelled) return;
        setAppointmentPatients(data.patients);
        setAppointmentDoctors(data.doctors);
        setAppointmentLocations(data.locations);
        setAppointmentShifts(data.shifts);
        setAppointments(data.appointments.map((appointment) => ({
          ...appointment,
          workContext: data.workplaces.find((workplace) => workplace.id === appointment.workplaceId)?.type === "hospital" ? "hospital" as const : "clinic" as const,
        })));
        if (data.workplaceId) setBackendWorkplaceId(data.workplaceId);
        setSyncMessage("Backend calendar loaded.");
      })
      .catch(() => {
        if (cancelled) return;
        setAppointmentPatients([]);
        setAppointmentDoctors([]);
        setAppointmentLocations([]);
        setAppointmentShifts([]);
        setAppointments([]);
        setSyncMessage("Unable to load the calendar from the backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCalendar(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkplaceId]);

  const contextPatients = useMemo(
    () => appointmentPatients.filter((patient) => patientInWorkContext(patient, workContext)),
    [appointmentPatients, workContext]
  );
  const contextLocations = appointmentLocations;
  const patientById = useMemo(
    () => new Map(appointmentPatients.map((patient) => [patient.id, patient])),
    [appointmentPatients]
  );
  const canScheduleAppointment = contextPatients.length > 0 && appointmentDoctors.length > 0 && contextLocations.length > 0;
  const weekStart = addDays(selectedDate, -Math.min(1, dateAtNoon(selectedDate).getDay()));
  const weekDates = Array.from({ length: 6 }, (_, index) => addDays(weekStart, index));
  const visibleDates = viewMode === "day" ? [selectedDate] : weekDates;
  const monthDates = getMonthDates(selectedDate);
  const rangeLabel =
    viewMode === "month"
      ? formatMonthLabel(selectedDate)
      : viewMode === "day"
        ? formatDateLabel(selectedDate)
        : `${formatDateLabel(weekDates[0])} - ${formatDateLabel(weekDates[weekDates.length - 1])}`;
  const visibleAppointments = appointments.filter(
    (appointment) => matchesWorkContext(appointment, workContext) && (showCancelled || appointment.status !== "Cancelled")
  );
  const selectedDateAppointments = visibleAppointments
    .filter((appointment) => appointment.date === selectedDate)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const activeSelectedDateAppointments = selectedDateAppointments.filter((appointment) => appointment.status !== "Completed");
  const completedSelectedDateAppointments = selectedDateAppointments.filter((appointment) => appointment.status === "Completed");
  const scheduleCounts = {
    today: selectedDateAppointments.length,
    waiting: selectedDateAppointments.filter((appointment) => appointment.status === "Scheduled" || appointment.status === "Checked In").length,
    engaged: selectedDateAppointments.filter((appointment) => appointment.status === "In Consultation").length,
    done: selectedDateAppointments.filter((appointment) => appointment.status === "Completed").length,
  };
  const slotInterval = Number(calendarSettings.slotInterval) || 15;
  const configuredStartMinutes = timeToMinutes(calendarSettings.calendarStartTime);
  const configuredEndMinutes = timeToMinutes(calendarSettings.calendarEndTime);
  const scheduleStartMinutes = configuredEndMinutes > configuredStartMinutes ? configuredStartMinutes : 8 * 60;
  const scheduleEndMinutes = configuredEndMinutes > configuredStartMinutes ? configuredEndMinutes : 18 * 60;
  const gridClassName =
    viewMode === "day"
      ? "min-w-[640px] grid-cols-[64px_minmax(480px,1fr)]"
      : "min-w-[920px] grid-cols-[64px_repeat(6,minmax(130px,1fr))]";

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      patientId: contextPatients[0]?.id ?? prev.patientId,
      locationId: contextLocations[0]?.id ?? prev.locationId,
      doctorId: appointmentDoctors[0]?.id ?? prev.doctorId,
    }));
  }, [appointmentDoctors, contextPatients, contextLocations]);

  function resetAppointmentForm() {
    setEditingAppointmentId(null);
    setAppointmentFormError("");
    setForm((prev) => ({
      ...prev,
      patientId: contextPatients[0]?.id ?? prev.patientId,
      doctorId: appointmentDoctors[0]?.id ?? prev.doctorId,
      locationId: contextLocations[0]?.id ?? prev.locationId,
      date: selectedDate,
      time: calendarSettings.visitStartTime,
      durationMins: "20",
      type: "In-Person",
      reason: "",
    }));
  }

  function openAppointmentForm(date = selectedDate, time = "09:00 AM") {
    setEditingAppointmentId(null);
    setAppointmentFormError("");
    setSelectedDate(date);
    setForm((prev) => ({
      ...prev,
      date,
      time,
      patientId: prev.patientId || contextPatients[0]?.id || "",
      doctorId: prev.doctorId || appointmentDoctors[0]?.id || "",
      locationId: prev.locationId || contextLocations[0]?.id || "",
    }));
    setShowForm(true);
  }

  function openEditAppointment(appointment: Appointment) {
    setEditingAppointmentId(appointment.id);
    setAppointmentFormError("");
    setSelectedConsultation(null);
    setSelectedDate(appointment.date);
    setForm({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      locationId: appointment.locationId ?? contextLocations[0]?.id ?? "",
      date: appointment.date,
      time: appointment.time,
      durationMins: String(appointment.durationMins),
      type: appointment.type,
      reason: appointment.reason,
    });
    setShowForm(true);
  }

  function moveVisibleRange(direction: -1 | 1) {
    if (viewMode === "month") {
      setSelectedDate((current) => addMonths(current, direction));
      return;
    }

    setSelectedDate((current) => addDays(current, viewMode === "day" ? direction : direction * 6));
  }

  function openSettingsPanel(panel: Exclude<CalendarSettingsPanel, null>) {
    setSettingsPanel(panel);
    setSettingsOpen(false);
  }

  function saveCalendarSettings() {
    setSettingsPanel(null);
    setSyncMessage("Appointment calendar settings updated.");
  }

  function printCalendar() {
    window.print();
    setSyncMessage("Print dialog opened for the appointment calendar.");
  }

  async function saveAppointment() {
    setAppointmentFormError("");
    if (!canScheduleAppointment) {
      setAppointmentFormError("Patient, doctor and location data must be available before scheduling.");
      return;
    }
    if (!form.patientId || !form.doctorId || !form.locationId || !form.date || !form.time.trim() || !form.reason.trim()) {
      setAppointmentFormError("Fill patient, doctor, location, date, time and reason before scheduling.");
      return;
    }
    if ((Number(form.durationMins) || 0) < 1) {
      setAppointmentFormError("Appointment duration must be greater than zero.");
      return;
    }

    const nextAppointment: Appointment = {
      id: editingAppointmentId ?? `local-apt-${Date.now()}`,
      patientId: form.patientId,
      doctorId: form.doctorId,
      locationId: form.locationId,
      workContext,
      date: form.date,
      time: form.time,
      durationMins: Number(form.durationMins) || 20,
      type: form.type,
      status: "Scheduled",
      reason: form.reason.trim(),
    };

    const appointmentStart = timeToMinutes(form.time);
    const appointmentEnd = appointmentStart + nextAppointment.durationMins;
    const hasAvailableShift = appointmentShifts.some((shift) =>
      shift.doctorId === form.doctorId &&
      shift.workplaceId === (backendWorkplaceId ?? selectedWorkplaceId) &&
      shift.date === form.date &&
      shift.bookingEnabled !== false &&
      (shift.status === "upcoming" || shift.status === "active") &&
      clockTimeToMinutes(shift.startTime) <= appointmentStart &&
      clockTimeToMinutes(shift.endTime) >= appointmentEnd
    );

    if (!hasAvailableShift) {
      const message = "This time is outside the doctor's available shift. Choose an earlier time, or extend the shift so it ends after the appointment.";
      setAppointmentFormError(message);
      setSyncMessage("Appointment was not saved: no available doctor shift covers the selected time.");
      return;
    }

    if (editingAppointmentId) {
      const existing = appointments.find((appointment) => appointment.id === editingAppointmentId);
      try {
        const savedAppointment = await updateBackendAppointment(editingAppointmentId, {
          ...nextAppointment,
          workplaceId: backendWorkplaceId ?? selectedWorkplaceId,
        });
        setAppointments((prev) =>
          prev.map((appointment) =>
            appointment.id === editingAppointmentId
              ? { ...savedAppointment, status: existing?.status ?? savedAppointment.status }
              : appointment
          )
        );
        setSyncMessage("Appointment changes synced to backend.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "The appointment was not updated.";
        setSyncMessage(`Backend sync failed: ${message}`);
        setAppointmentFormError(formatAppointmentSaveError(message));
        return;
      }
      setSelectedDate(form.date);
      resetAppointmentForm();
      setShowForm(false);
      return;
    }

    try {
      const savedAppointment = await createBackendAppointment({
        ...nextAppointment,
        workplaceId: backendWorkplaceId ?? selectedWorkplaceId,
      });
      setAppointments((prev) => [savedAppointment, ...prev]);
      setSyncMessage("Appointment saved to backend.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The appointment was not saved.";
      setSyncMessage(`Backend sync failed: ${message}`);
      setAppointmentFormError(formatAppointmentSaveError(message));
      return;
    }

    setSelectedDate(form.date);
    resetAppointmentForm();
    setShowForm(false);
  }

  async function deleteAppointment(appointment: Appointment) {
    if (!window.confirm("Delete this appointment from the schedule?")) return;

    try {
      await deleteBackendAppointment(appointment.id);
      setSyncMessage("Appointment deleted from backend.");
    } catch (error) {
      setSyncMessage(`Backend delete failed: ${error instanceof Error ? error.message : "appointment was not deleted."}`);
      return;
    }
    setAppointments((prev) => prev.filter((item) => item.id !== appointment.id));
    setSelectedConsultation(null);
  }

  const slots = Array.from(
    { length: Math.floor((scheduleEndMinutes - scheduleStartMinutes) / slotInterval) + 1 },
    (_, index) => scheduleStartMinutes + index * slotInterval
  );

  if (isLoadingCalendar) {
    return (
      <div className={clsx("min-h-[calc(100vh-9rem)] overflow-hidden rounded-md border border-line bg-white shadow-card", modernTheme && "shadow-lift")}>
        <div className="flex min-h-[calc(100vh-9rem)]">
          <aside className="hidden w-[268px] shrink-0 border-r border-line bg-paper lg:block">
            <div className="border-b border-line bg-white px-4 py-4">
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="border-b border-line px-5 py-4">
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="border-b border-line px-5 py-4">
              <Skeleton className="mb-4 h-3 w-24" />
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="mb-3 h-5 w-full" />
              ))}
            </div>
          </aside>
          <section className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 border-b border-line bg-paper/70 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <Skeleton className="h-8 w-40" />
                <Skeleton className="mt-2 h-4 w-56" />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-36" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border border-line bg-white p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-7 w-12" />
                </div>
              ))}
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <div className="min-w-[920px] rounded-md border border-line">
                <div className="grid grid-cols-[64px_repeat(6,minmax(130px,1fr))] border-b border-line">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="border-r border-line p-3 last:border-r-0">
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
                {Array.from({ length: 10 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-[64px_repeat(6,minmax(130px,1fr))] border-b border-line last:border-b-0">
                    {Array.from({ length: 7 }).map((_, columnIndex) => (
                      <div key={columnIndex} className="min-h-16 border-r border-line p-2 last:border-r-0">
                        {columnIndex > 0 && rowIndex % 3 === columnIndex % 3 && <Skeleton className="h-10 w-full" />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "min-h-[calc(100vh-9rem)] overflow-hidden rounded-md border border-line bg-white shadow-card",
        modernTheme && "shadow-lift"
      )}
    >
      <div className="flex min-h-[calc(100vh-9rem)]">
        <aside className="hidden w-[268px] shrink-0 border-r border-line bg-paper lg:block">
          <div className="border-b border-line bg-white px-4 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
              <input className="input-field pl-9" placeholder="Search patients" />
            </div>
          </div>
          <div className="border-b border-line px-5 py-4">
            <button type="button" className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays size={16} /> Block Calendar
            </button>
          </div>
          <div className="border-b border-line">
            <p className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Doctors</p>
            <button className="flex w-full items-center justify-between bg-brand-500 px-5 py-2 text-left text-sm font-semibold text-white">
              <span>All doctors</span>
              <span>{visibleAppointments.length}</span>
            </button>
            {appointmentDoctors.map((doctor) => (
              <button key={doctor.id} className="flex w-full items-center justify-between px-5 py-2 text-left text-sm text-ink-soft hover:bg-white">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sage-500" />
                  <span className="truncate">{doctor.name}</span>
                </span>
                <span>{visibleAppointments.filter((appointment) => appointment.doctorId === doctor.id).length}</span>
              </button>
            ))}
          </div>
          <div className="px-5 py-4">
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Categories</p>
            <p className="text-center text-sm text-ink-muted">Categories are not required for this appointment calendar.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 border-b border-line bg-paper/70 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl text-ink">Calendar</h1>
                <p className="truncate text-sm text-ink-muted">{workContext === "hospital" ? "Hospital Duty" : appointmentLocations[0]?.name ?? "Doctor calendar"}</p>
              </div>
              {syncMessage && <p className="mt-1 text-xs text-ink-muted">{syncMessage}</p>}
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 xl:w-auto xl:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex items-center rounded-md border border-line bg-white">
                  <button type="button" onClick={() => moveVisibleRange(-1)} className="btn-ghost rounded-r-none" aria-label="Previous range">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-[220px] border-x border-line px-3 text-center font-mono text-sm font-semibold text-ink">{rangeLabel}</span>
                  <button type="button" onClick={() => moveVisibleRange(1)} className="btn-ghost rounded-l-none" aria-label="Next range">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button type="button" onClick={() => setSelectedDate(CURRENT_DATE_ISO)} className="btn-secondary">
                  Today
                </button>
                <div className="grid grid-cols-3 rounded-md border border-line bg-white p-0.5">
                  {viewOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setViewMode(item.value)}
                      className={clsx(
                        "rounded px-4 py-1.5 text-xs font-semibold",
                        viewMode === item.value ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-paper"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={printCalendar} className="btn-secondary" aria-label="Print calendar">
                  <Printer size={16} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((open) => !open)}
                    className="btn-secondary"
                    aria-expanded={settingsOpen}
                  >
                    <Settings size={15} /> Settings
                  </button>
                  {settingsOpen && (
                    <div className="absolute right-0 top-full z-40 mt-1 w-[364px] overflow-hidden rounded-md border border-line bg-white py-1 text-sm shadow-lift">
                      {[
                        ["Modify calendar timings", "calendarTiming"],
                        ["Add/ edit doctor or staff, modify SMS/ email for doctors/staff", "staffNotifications"],
                        ["Modify doctor visit timings", "visitTiming"],
                        ["Modify SMS/ Email for patients", "patientNotifications"],
                      ].map(([label, panel]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => openSettingsPanel(panel as Exclude<CalendarSettingsPanel, null>)}
                          className="block w-full px-5 py-2.5 text-left leading-5 text-ink-muted hover:bg-paper hover:text-ink"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setModernTheme((value) => {
                            const next = !value;
                            setSyncMessage(`Modern theme ${next ? "enabled" : "disabled"}.`);
                            return next;
                          });
                        }}
                        className="grid w-full grid-cols-[1fr_76px] items-center bg-clay-50 px-5 py-2.5 text-left text-ink hover:bg-clay-100"
                      >
                        <span>Modern Theme</span>
                        <span className="flex h-5 items-center justify-between border border-clay-400 bg-white text-[10px] font-semibold text-clay-600">
                          <span className={clsx("flex h-full w-10 items-center justify-center text-white", modernTheme ? "bg-clay-500" : "bg-ink-faint")}>
                            {modernTheme ? "ON" : "OFF"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCancelled((value) => {
                            const next = !value;
                            setSyncMessage(`${next ? "Showing" : "Hiding"} cancelled appointments.`);
                            return next;
                          });
                        }}
                        className="grid w-full grid-cols-[1fr_76px] items-center px-5 py-2.5 text-left text-ink-muted hover:bg-paper hover:text-ink"
                      >
                        <span>Show Cancelled Appointments</span>
                        <span className="flex h-5 items-center justify-between border border-clay-400 bg-white text-[10px] font-semibold text-clay-600">
                          <span className={clsx("flex h-full w-10 items-center justify-center text-white", showCancelled ? "bg-clay-500" : "bg-ink-faint")}>
                            {showCancelled ? "YES" : "NO"}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openAppointmentForm()}
                  disabled={!canScheduleAppointment}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={14} /> New Appointment
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-h-[calc(100vh-15rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_356px]">
            <div className="min-w-0 overflow-auto">
              {viewMode === "month" ? (
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-7 border-b border-line bg-white">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="border-r border-line px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDates.map((date) => {
                      const value = dateAtNoon(date);
                      const inCurrentMonth = value.getMonth() === dateAtNoon(selectedDate).getMonth();
                      const dayAppointments = visibleAppointments
                        .filter((appointment) => appointment.date === date)
                        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

                      return (
                        <div
                          key={date}
                          role="button"
                          tabIndex={0}
                          onClick={() => openAppointmentForm(date, "09:00 AM")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") openAppointmentForm(date, "09:00 AM");
                          }}
                          className={clsx(
                            "min-h-32 cursor-pointer border-b border-r border-line bg-white p-2 text-left transition-colors hover:bg-brand-50/60",
                            date === selectedDate && "bg-clay-50/70",
                            !inCurrentMonth && "bg-paper/70 text-ink-faint"
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{value.getDate()}</span>
                            {date === CURRENT_DATE_ISO && <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Today</span>}
                          </div>
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 3).map((appointment) => {
                              const patient = patientById.get(appointment.patientId);
                              return (
                                <button
                                  key={appointment.id}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedConsultation(appointment);
                                  }}
                                  className={clsx(
                                    "block w-full truncate rounded border px-2 py-1 text-left text-[11px] font-semibold",
                                    appointment.status === "Completed"
                                      ? "border-sage-200 bg-sage-50 text-sage-600"
                                      : appointment.status === "Cancelled"
                                        ? "border-ink-faint bg-paper text-ink-muted"
                                        : "border-brand-100 bg-brand-50 text-brand-800"
                                  )}
                                >
                                  {appointment.time} {patient?.name ?? "Patient"}
                                </button>
                              );
                            })}
                            {dayAppointments.length > 3 && (
                              <p className="px-1 text-[11px] font-semibold text-ink-muted">+{dayAppointments.length - 3} more</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className={clsx("grid border-b border-line bg-white", gridClassName)}>
                    <div className="border-r border-line px-2 py-3 text-center text-xs text-ink-faint">
                      <Clock3 className="mx-auto mb-1" size={15} />
                      all-day
                    </div>
                    {visibleDates.map((date) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={clsx(
                          "border-r border-line px-3 py-3 text-center text-xs font-semibold transition-colors",
                          date === selectedDate ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-paper"
                        )}
                      >
                        {formatDayHeader(date)}
                      </button>
                    ))}
                  </div>

                  <div className={clsx("grid", gridClassName)}>
                    <div className="border-r border-line bg-white">
                      {slots.map((slot) => (
                        <div key={slot} className="h-10 border-b border-line/80 px-1 py-1 text-right font-mono text-[11px] text-ink-faint">
                          {minutesToTime(slot)}
                        </div>
                      ))}
                    </div>
                    {visibleDates.map((date) => (
                      <div key={date} className={clsx("relative border-r border-line", date === selectedDate && "bg-clay-50/45")}>
                        {slots.map((slot) => (
                          <button
                            key={`${date}-${slot}`}
                            type="button"
                            onClick={() => openAppointmentForm(date, minutesToTime(slot))}
                            className="block h-10 w-full border-b border-line/80 text-left transition-colors hover:bg-brand-50/70 focus-visible:z-10"
                            aria-label={`Create appointment on ${date} at ${minutesToTime(slot)}`}
                          />
                        ))}
                        {visibleAppointments
                          .filter((appointment) => appointment.date === date)
                          .map((appointment) => {
                            const top = Math.max(0, ((timeToMinutes(appointment.time) - slots[0]) / slotInterval) * 40);
                            const patient = patientById.get(appointment.patientId);
                            return (
                              <button
                                key={appointment.id}
                                type="button"
                                onClick={() => setSelectedConsultation(appointment)}
                                className={clsx(
                                  "absolute left-1 right-1 z-20 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-card",
                                  appointment.status === "In Consultation"
                                    ? "border-brand-500 bg-brand-500 text-white"
                                    : appointment.status === "Completed"
                                      ? "border-sage-200 bg-sage-50 text-sage-600"
                                      : appointment.status === "Cancelled"
                                        ? "border-ink-faint bg-paper text-ink-muted"
                                        : "border-brand-100 bg-brand-50 text-brand-800"
                                )}
                                style={{ top, height: durationRows(appointment.durationMins, slotInterval) * 40 - 4 }}
                              >
                                <span className="block truncate font-semibold">{patient?.name ?? "Patient"}</span>
                                <span className="block truncate font-mono text-[11px] opacity-80">{appointment.time}</span>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <aside className="border-t border-line bg-white xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Today&apos;s Schedule</h2>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="btn-ghost" aria-label="Previous day">
                    <ChevronLeft size={15} />
                  </button>
                  <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="btn-ghost" aria-label="Next day">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div className="border-b border-line px-5 py-4">
                <button
                  type="button"
                  onClick={() => openAppointmentForm(selectedDate, "09:00 AM")}
                  disabled={!canScheduleAppointment}
                  className="w-full rounded-md border border-clay-400 px-3 py-2 text-sm font-semibold text-clay-500 hover:bg-clay-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Walk-in Appointment
                </button>
              </div>
              <div className="grid grid-cols-4 border-b border-line px-4 py-4 text-center">
                {[
                  ["Today", scheduleCounts.today, "bg-brand-500"],
                  ["Waiting", scheduleCounts.waiting, "bg-alert-500"],
                  ["Engaged", scheduleCounts.engaged, "bg-cyan-500"],
                  ["Done", scheduleCounts.done, "bg-sage-500"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="border-r border-line last:border-r-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
                    <span className={clsx("mt-2 inline-flex min-w-10 justify-center rounded px-2 py-1 font-mono text-xs font-semibold text-white", tone)}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 px-4 py-4">
                {selectedDateAppointments.length === 0 ? (
                  <p className="py-4 text-sm text-ink-muted">No appointments</p>
                ) : (
                  <>
                    {activeSelectedDateAppointments.map((appointment) => {
                      const patient = patientById.get(appointment.patientId);
                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => setSelectedConsultation(appointment)}
                          className="w-full rounded-md border border-line bg-paper/60 p-3 text-left transition-colors hover:border-brand-100 hover:bg-brand-50"
                        >
                          <div className="flex items-start gap-3">
                            {patient ? <Avatar initials={patient.avatarInitials} size={34} /> : <UserRound size={28} />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">{patient?.name ?? "Patient"}</p>
                              <p className="mt-0.5 truncate text-xs text-ink-muted">{appointment.reason}</p>
                              <p className="mt-2 flex items-center gap-1 font-mono text-[11px] text-ink-muted">
                                {appointment.type === "Video" ? <Video size={12} /> : <MapPin size={12} />}
                                {appointment.time} - {appointment.durationMins} min
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {completedSelectedDateAppointments.length > 0 && (
                      <div className="pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage-500">Completed</p>
                        {completedSelectedDateAppointments.map((appointment) => {
                          const patient = patientById.get(appointment.patientId);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => setSelectedConsultation(appointment)}
                              className="mb-2 w-full rounded-md border border-sage-100 bg-sage-50 p-3 text-left transition-colors hover:border-sage-200"
                            >
                              <div className="flex items-start gap-3">
                                {patient ? <Avatar initials={patient.avatarInitials} size={34} /> : <UserRound size={28} />}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-ink">{patient?.name ?? "Patient"}</p>
                                  <p className="mt-0.5 truncate text-xs text-ink-muted">{appointment.reason}</p>
                                  <p className="mt-2 flex items-center gap-1 font-mono text-[11px] text-sage-600">
                                    {appointment.time} - completed
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>

      <Modal
        open={showForm}
        title={editingAppointmentId ? "Edit Appointment" : "Schedule Appointment"}
        eyebrow="Appointment"
        onClose={() => {
          resetAppointmentForm();
          setShowForm(false);
        }}
        footer={
          <>
            <button
              type="button"
              onClick={saveAppointment}
              disabled={!canScheduleAppointment}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingAppointmentId ? "Save Changes" : "Schedule Appointment"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetAppointmentForm();
                setShowForm(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {appointmentFormError && (
            <div className="sm:col-span-2 rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {appointmentFormError}
            </div>
          )}
          <Field label="Patient" className="sm:col-span-2">
            <select
              value={form.patientId}
              onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
              className="input-field"
            >
              {contextPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({patient.mrn})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Doctor">
            <select
              value={form.doctorId}
              onChange={(event) => setForm((prev) => ({ ...prev, doctorId: event.target.value }))}
              className="input-field"
            >
              {appointmentDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              value={form.locationId}
              onChange={(event) => setForm((prev) => ({ ...prev, locationId: event.target.value }))}
              className="input-field"
            >
              {contextLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              type="date"
              className="input-field"
            />
          </Field>
          <Field label="Time">
            <input
              type="time"
              value={toNativeTime(form.time)}
              onChange={(event) => setForm((prev) => ({ ...prev, time: fromNativeTime(event.target.value) }))}
              step={900}
              aria-label="Appointment time"
              className="input-field"
            />
          </Field>
          <Field label="Duration">
            <select
              value={form.durationMins}
              onChange={(event) => setForm((prev) => ({ ...prev, durationMins: event.target.value }))}
              className="input-field"
            >
              <option value="15">15 min</option>
              <option value="20">20 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
            </select>
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as AppointmentType }))}
              className="input-field"
            >
              <option>In-Person</option>
              <option>Video</option>
              <option>Follow-up</option>
            </select>
          </Field>
          <Field label="Reason for Visit" className="sm:col-span-2">
            <input
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Reason for visit"
              className="input-field"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={settingsPanel !== null}
        title={settingsPanel ? settingsPanelTitles[settingsPanel] : "Calendar Settings"}
        eyebrow="Appointment settings"
        onClose={() => setSettingsPanel(null)}
        footer={
          <>
            <button type="button" onClick={saveCalendarSettings} className="btn-primary">
              Save Settings
            </button>
            <button type="button" onClick={() => setSettingsPanel(null)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
        {settingsPanel === "calendarTiming" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Calendar starts">
              <TimePicker
                value={calendarSettings.calendarStartTime}
                onChange={(value) => setCalendarSettings((prev) => ({ ...prev, calendarStartTime: value }))}
                format="12h"
                ariaLabel="Calendar start time"
              />
            </Field>
            <Field label="Calendar ends">
              <TimePicker
                value={calendarSettings.calendarEndTime}
                onChange={(value) => setCalendarSettings((prev) => ({ ...prev, calendarEndTime: value }))}
                format="12h"
                ariaLabel="Calendar end time"
              />
            </Field>
            <Field label="Slot interval" className="sm:col-span-2">
              <select
                value={calendarSettings.slotInterval}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, slotInterval: event.target.value }))}
                className="input-field"
              >
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </Field>
          </div>
        )}

        {settingsPanel === "staffNotifications" && (
          <div className="space-y-3">
            {[
              ["staffSms", "Send SMS updates to doctor and staff"],
              ["staffEmail", "Send email updates to doctor and staff"],
              ["staffReminders", "Send schedule reminders before visits"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-soft">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(calendarSettings[key as "staffSms" | "staffEmail" | "staffReminders"])}
                  onChange={(event) => setCalendarSettings((prev) => ({ ...prev, [key]: event.target.checked }))}
                  className="h-4 w-4 accent-brand-500"
                />
              </label>
            ))}
          </div>
        )}

        {settingsPanel === "visitTiming" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Visit starts">
              <TimePicker
                value={calendarSettings.visitStartTime}
                onChange={(value) => setCalendarSettings((prev) => ({ ...prev, visitStartTime: value }))}
                format="12h"
                ariaLabel="Doctor visit start time"
              />
            </Field>
            <Field label="Visit ends">
              <TimePicker
                value={calendarSettings.visitEndTime}
                onChange={(value) => setCalendarSettings((prev) => ({ ...prev, visitEndTime: value }))}
                format="12h"
                ariaLabel="Doctor visit end time"
              />
            </Field>
          </div>
        )}

        {settingsPanel === "patientNotifications" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-soft sm:col-span-2">
              <span>Send SMS updates to patients</span>
              <input
                type="checkbox"
                checked={calendarSettings.patientSms}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, patientSms: event.target.checked }))}
                className="h-4 w-4 accent-brand-500"
              />
            </label>
            <label className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-soft sm:col-span-2">
              <span>Send email updates to patients</span>
              <input
                type="checkbox"
                checked={calendarSettings.patientEmail}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, patientEmail: event.target.checked }))}
                className="h-4 w-4 accent-brand-500"
              />
            </label>
            <Field label="Reminder before appointment" className="sm:col-span-2">
              <select
                value={calendarSettings.patientReminderHours}
                onChange={(event) => setCalendarSettings((prev) => ({ ...prev, patientReminderHours: event.target.value }))}
                className="input-field"
              >
                <option value="2">2 hours</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
              </select>
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(selectedConsultation)}
        title="Consultation"
        eyebrow={selectedConsultation ? `${selectedConsultation.date} - ${selectedConsultation.time}` : undefined}
        onClose={() => setSelectedConsultation(null)}
        size="xl"
        footer={
          selectedConsultation && (
            <>
              <button type="button" onClick={() => openEditAppointment(selectedConsultation)} className="btn-secondary">
                Edit Appointment
              </button>
              <button type="button" onClick={() => deleteAppointment(selectedConsultation)} className="btn-secondary text-alert-500">
                Delete Appointment
              </button>
            </>
          )
        }
      >
        {selectedConsultation && (
          <ConsultationForm
            patients={appointmentPatients}
            appointmentId={selectedConsultation.id}
            workplaceId={selectedConsultation.workplaceId ?? backendWorkplaceId ?? selectedWorkplaceId}
            preselectedPatientId={selectedConsultation.patientId}
            labOrderMode="modal"
            prescriptionMode="modal"
            showHeading={false}
            onFinalized={(appointmentId) => {
              if (!appointmentId) return;
              setAppointments((prev) => prev.map((appointment) => appointment.id === appointmentId ? { ...appointment, status: "Completed" } : appointment));
              setSelectedConsultation((current) => current && current.id === appointmentId ? { ...current, status: "Completed" } : current);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
