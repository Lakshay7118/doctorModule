"use client";

import * as React from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  PhoneCall,
  PlayCircle,
  Printer,
  Search,
  TicketCheck,
} from "lucide-react";
import { TimePicker } from "@/components/ui";
import { getBackendReceptionistAppointmentSlip, type BackendReceptionistAppointmentSlip } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Mono, SectionHeader, Select, Table } from "./ui";
import { useReceptionistData } from "./data-context";
import type { QueueEntry } from "./mock-data";
import { formatReceptionistDate, isPastReceptionistAppointment, nextBookableReceptionistTime, todayIso } from "./date-utils";

const statusTone: Record<QueueEntry["status"], "pine" | "amber" | "slate"> = {
  Waiting: "amber",
  "In Consultation": "pine",
  Completed: "slate",
};

const statusOptions = ["All", "Waiting", "In Consultation", "Completed"] as const;
type StatusFilter = (typeof statusOptions)[number];

function parseDisplayTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function waitLabel(checkedInAt: string) {
  const checkedInMinutes = parseDisplayTimeToMinutes(checkedInAt);
  if (checkedInMinutes === null) return "-";

  const now = new Date();
  const elapsed = Math.max(0, now.getHours() * 60 + now.getMinutes() - checkedInMinutes);
  if (elapsed < 1) return "Just now";
  if (elapsed < 60) return `${elapsed} min`;
  return `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
}

function nextStatus(status: QueueEntry["status"]) {
  if (status === "Waiting") return "In Consultation" as const;
  if (status === "In Consultation") return "Completed" as const;
  return status;
}

function escapePrintValue(value: unknown) {
  return String(value ?? "-").replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function consultationSlipHtml(slip: BackendReceptionistAppointmentSlip) {
  const value = (input: unknown) => escapePrintValue(input);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Consultation slip - ${value(slip.patient.name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; color: #17251f; background: #eef4f0; font-family: Arial, sans-serif; }
      .slip { width: 100%; max-width: 720px; margin: 0 auto; padding: 28px; background: #fff; border: 1px solid #cbd8d0; }
      .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #1d7456; }
      .eyebrow { margin: 0 0 5px; color: #1d7456; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 24px; }
      .muted { color: #64756d; font-size: 12px; }
      .meta { text-align: right; font-size: 12px; }
      .meta strong { display: block; margin-top: 4px; font-size: 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; padding: 22px 0; }
      .field { min-width: 0; }
      .label { margin-bottom: 4px; color: #64756d; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
      .reason { min-height: 58px; padding-top: 16px; border-top: 1px solid #dbe4df; }
      .footer { display: flex; justify-content: space-between; gap: 20px; padding-top: 18px; border-top: 1px solid #dbe4df; color: #64756d; font-size: 11px; }
      @media print { body { padding: 0; background: #fff; } .slip { max-width: none; border: 0; } }
    </style>
  </head>
  <body>
    <main class="slip">
      <header class="header">
        <div><p class="eyebrow">${value(slip.organizationName)}</p><h1>Consultation Slip</h1><p class="muted">Outpatient department visit</p></div>
        <div class="meta"><span>Appointment ID</span><strong>${value(slip.id)}</strong><span>${value(slip.status)}</span></div>
      </header>
      <section class="grid">
        <div class="field"><div class="label">Patient</div><div class="value">${value(slip.patient.name)}</div></div>
        <div class="field"><div class="label">UHID</div><div class="value">${value(slip.patient.uhid)}</div></div>
        <div class="field"><div class="label">Age / gender</div><div class="value">${value(slip.patient.age)} / ${value(slip.patient.gender)}</div></div>
        <div class="field"><div class="label">Phone</div><div class="value">${value(slip.patient.phone)}</div></div>
        <div class="field"><div class="label">Doctor</div><div class="value">${value(slip.doctor.name)}</div></div>
        <div class="field"><div class="label">Department</div><div class="value">${value(slip.doctor.department)}</div></div>
        <div class="field"><div class="label">Date</div><div class="value">${value(slip.date)}</div></div>
        <div class="field"><div class="label">Time</div><div class="value">${value(slip.time)}</div></div>
        <div class="field"><div class="label">Visit type</div><div class="value">${value(slip.mode.replaceAll("_", " "))}</div></div>
        <div class="field"><div class="label">Check-in</div><div class="value">${value(slip.checkedInAt)}</div></div>
      </section>
      <section class="reason"><div class="label">Reason for visit</div><div class="value">${value(slip.reason)}</div></section>
      <footer class="footer"><span>Generated ${value(new Date(slip.generatedAt).toLocaleString())}</span><span>Please carry this slip during consultation.</span></footer>
    </main>
  </body>
</html>`;
}

export function OPDManagement() {
  const { appointments, doctors, patients, queue, addAppointment, checkIn, advanceQueueStatus, recordAction } =
    useReceptionistData();
  const [query, setQuery] = React.useState("");
  const [department, setDepartment] = React.useState("All");
  const [status, setStatus] = React.useState<StatusFilter>("All");
  const [actionMessage, setActionMessage] = React.useState("");
  const [appointmentsModalOpen, setAppointmentsModalOpen] = React.useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = React.useState(false);
  const [issuedToken, setIssuedToken] = React.useState("");
  const [previewSlip, setPreviewSlip] = React.useState<BackendReceptionistAppointmentSlip | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const today = todayIso();
  const todayLabel = formatReceptionistDate(today);
  const nextBookableTime = nextBookableReceptionistTime();
  const [appointmentForm, setAppointmentForm] = React.useState({
    uhid: patients[0]?.uhid ?? "",
    doctor: doctors[0]?.name ?? "",
    date: today,
    time: nextBookableTime,
  });
  const [checkInForm, setCheckInForm] = React.useState({
    uhid: patients[0]?.uhid ?? "",
    doctor: doctors[0]?.name ?? "",
  });

  React.useEffect(() => {
    setAppointmentForm((current) => ({
      ...current,
      uhid: current.uhid || patients[0]?.uhid || "",
      doctor: current.doctor || doctors[0]?.name || "",
    }));
    setCheckInForm((current) => ({
      ...current,
      uhid: current.uhid || patients[0]?.uhid || "",
      doctor: current.doctor || doctors[0]?.name || "",
    }));
  }, [doctors, patients]);

  const opdDepartments = React.useMemo(() => {
    const names = Array.from(new Set([...doctors.map((doctor) => doctor.department), ...queue.map((entry) => entry.department)].filter(Boolean)));
    return (names.length > 0 ? names : ["General Medicine"]).filter((item) => item !== "Emergency");
  }, [doctors, queue]);
  const activeQueue = queue.filter((entry) => entry.status !== "Completed");

  const filteredQueue = queue.filter((entry) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      entry.token.toLowerCase().includes(q) ||
      entry.patient.toLowerCase().includes(q) ||
      entry.doctor.toLowerCase().includes(q) ||
      entry.department.toLowerCase().includes(q);
    const matchesDepartment = department === "All" || entry.department === department;
    const matchesStatus = status === "All" || entry.status === status;
    return matchesQuery && matchesDepartment && matchesStatus;
  });

  const departmentSummary = opdDepartments.map((item) => ({
    department: item,
    total: queue.filter((entry) => entry.department === item).length,
    active: queue.filter((entry) => entry.department === item && entry.status !== "Completed").length,
  }));

  const doctorLoad = doctors
    .map((doctor) => ({
      doctor,
      waiting: queue.filter((entry) => entry.doctor === doctor.name && entry.status === "Waiting").length,
      consulting: queue.filter((entry) => entry.doctor === doctor.name && entry.status === "In Consultation").length,
      completed: queue.filter((entry) => entry.doctor === doctor.name && entry.status === "Completed").length,
    }))
    .filter((row) => row.waiting + row.consulting + row.completed > 0);

  const waitingCount = queue.filter((entry) => entry.status === "Waiting").length;
  const consultingCount = queue.filter((entry) => entry.status === "In Consultation").length;
  const completedCount = queue.filter((entry) => entry.status === "Completed").length;
  const isPastAppointmentSlot = isPastReceptionistAppointment(appointmentForm.date, appointmentForm.time);

  function handleCall(entry: QueueEntry) {
    recordAction({
      action: "PATIENT_CALLED",
      subject: "Patient called to OPD",
      detail: `${entry.token} - ${entry.patient} called for ${entry.doctor}.`,
      relatedType: "appointment",
      relatedId: entry.appointmentId,
    });
    setActionMessage(`${entry.token} - ${entry.patient} called for ${entry.doctor}.`);
  }

  function handleAdvance(entry: QueueEntry) {
    const updatedStatus = nextStatus(entry.status);
    advanceQueueStatus(entry.token, updatedStatus);
    recordAction({
      action: "OPD_STATUS_UPDATED",
      subject: "OPD status updated",
      detail: `${entry.token} moved to ${updatedStatus}.`,
      relatedType: "appointment",
      relatedId: entry.appointmentId,
    });
    setActionMessage(`${entry.token} moved to ${updatedStatus}.`);
  }

  function openPrintWindow() {
    const printWindow = window.open("", "_blank", "width=820,height=900");
    if (!printWindow) {
      setActionMessage("Printing was blocked. Allow pop-ups for this page and try again.");
      return null;
    }
    printWindow.document.write("<p style=\"font-family:Arial;padding:24px\">Preparing consultation slip...</p>");
    return printWindow;
  }

  function printSlipDocument(slip: BackendReceptionistAppointmentSlip, printWindow: Window) {
    printWindow.document.open();
    printWindow.document.write(consultationSlipHtml(slip));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 150);
  }

  async function handleSlip(entry: QueueEntry) {
    if (!entry.appointmentId) {
      setActionMessage("This queue entry is not linked to a saved appointment.");
      return;
    }

    const printWindow = openPrintWindow();
    if (!printWindow) return;

    try {
      const slip = await getBackendReceptionistAppointmentSlip(entry.appointmentId, entry.workplaceId);
      printSlipDocument(slip, printWindow);
      recordAction({
        action: "CONSULTATION_SLIP_PRINTED",
        subject: "Consultation slip reprinted",
        detail: `${entry.token} slip prepared for ${slip.patient.name}.`,
        relatedType: "appointment",
        relatedId: entry.appointmentId,
      });
      setActionMessage(`${entry.token} slip prepared for ${slip.patient.name}.`);
    } catch (error) {
      printWindow.close();
      setActionMessage(error instanceof Error ? error.message : "Consultation slip could not be loaded from the backend.");
    }
  }

  async function handlePreviewTemplate() {
    const queueEntry = queue.find((entry) => entry.appointmentId);
    const appointment = queueEntry
      ? undefined
      : appointments.find((item) => item.backendId);
    const appointmentId = queueEntry?.appointmentId ?? appointment?.backendId;
    const workplaceId = queueEntry?.workplaceId ?? appointment?.workplaceId;

    if (!appointmentId) {
      setActionMessage("No saved appointment is available for a consultation slip preview.");
      return;
    }

    setPreviewLoading(true);
    try {
      const slip = await getBackendReceptionistAppointmentSlip(appointmentId, workplaceId);
      setPreviewSlip(slip);
      recordAction({
        action: "CONSULTATION_SLIP_PRINTED",
        subject: "Consultation slip template previewed",
        detail: `Preview opened for ${slip.patient.name}.`,
        relatedType: "appointment",
        relatedId: slip.id,
      });
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Consultation slip preview could not be loaded from the backend.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handlePrintPreview() {
    if (!previewSlip) return;
    const printWindow = openPrintWindow();
    if (!printWindow) return;
    printSlipDocument(previewSlip, printWindow);
    setActionMessage(`Consultation slip prepared for ${previewSlip.patient.name}.`);
  }

  async function handleBookAppointment(event: React.FormEvent) {
    event.preventDefault();
    if (isPastReceptionistAppointment(appointmentForm.date, appointmentForm.time)) {
      setActionMessage("Select a future appointment time before confirming.");
      return;
    }

    const patient = patients.find((item) => item.uhid === appointmentForm.uhid);
    const doctor = doctors.find((item) => item.name === appointmentForm.doctor);
    if (!patient || !doctor) return;

    try {
      const appointment = await addAppointment({
        patient: patient.name,
        uhid: patient.uhid,
        doctor: doctor.name,
        department: doctor.department,
        date: appointmentForm.date,
        time: appointmentForm.time,
        status: "Confirmed",
      });
      setAppointmentsModalOpen(false);
      setActionMessage(`${appointment.id} booked for ${appointment.patient} with ${appointment.doctor}.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Appointment could not be saved to the backend database.");
    }
  }

  function handleCheckInPatient(event: React.FormEvent) {
    event.preventDefault();
    const patient = patients.find((item) => item.uhid === checkInForm.uhid);
    const doctor = doctors.find((item) => item.name === checkInForm.doctor);
    if (!patient || !doctor) return;

    const entry = checkIn({
      patient: patient.name,
      doctor: doctor.name,
      department: doctor.department,
      checkedInAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "Waiting",
    });
    setIssuedToken(entry.token);
    setCheckInModalOpen(false);
    setActionMessage(`${entry.patient} added to OPD queue with token ${entry.token}.`);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - OPD"
        title="OPD management"
        description="Manage the live outpatient flow after check-in: queue movement, doctor load, consultation slips and department allocation."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAppointmentsModalOpen(true)}>
              <Clock size={16} /> Appointments
            </Button>
            <Button onClick={() => setCheckInModalOpen(true)}>
              <TicketCheck size={16} /> Check In Patient
            </Button>
          </div>
        }
      />

      <Modal
        open={appointmentsModalOpen}
        title="Appointments"
        eyebrow="OPD - Appointment Desk"
        onClose={() => setAppointmentsModalOpen(false)}
        size="xl"
      >
        <form onSubmit={handleBookAppointment} className="mb-5 rounded-md border border-line bg-paper/70 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Patient" required>
              <Select
                value={appointmentForm.uhid}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, uhid: event.target.value }))}
              >
                {patients.map((patient) => (
                  <option key={patient.uhid} value={patient.uhid}>
                    {patient.name} - {patient.uhid}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Doctor" required hint="Department is set automatically based on the doctor">
              <Select
                value={appointmentForm.doctor}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, doctor: event.target.value }))}
              >
                {doctors.map((doctor) => (
                  <option key={doctor.name} value={doctor.name}>
                    {doctor.name} - {doctor.department}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input
                type="date"
                min={today}
                value={appointmentForm.date}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </Field>
            <Field label="Time" required>
              <TimePicker
                value={appointmentForm.time}
                onChange={(value) => setAppointmentForm((current) => ({ ...current, time: value }))}
                format="12h"
                ariaLabel="OPD appointment time"
              />
            </Field>
          </div>
          {isPastAppointmentSlot && (
            <p className="mt-3 rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
              Select a future time for today, or choose a later appointment date.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" disabled={isPastAppointmentSlot}>
              <CalendarPlus size={16} /> Confirm Appointment
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAppointmentsModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Current appointments</h3>
          <Badge tone="pine">{appointments.filter((appointment) => appointment.status === "Confirmed").length} confirmed</Badge>
        </div>
        <Table columns={["ID", "Patient", "Doctor", "Date", "Time", "Status"]}>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td><Mono>{appointment.id}</Mono></td>
              <td className="font-medium text-[var(--rp-ink)]">{appointment.patient}</td>
              <td>{appointment.doctor}</td>
              <td>{appointment.date}</td>
              <td><Mono>{appointment.time}</Mono></td>
              <td><Badge tone={appointment.status === "Confirmed" ? "pine" : appointment.status === "Pending" ? "amber" : appointment.status === "Cancelled" ? "coral" : "slate"}>{appointment.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </Modal>

      <Modal
        open={checkInModalOpen}
        title="Check In Patient"
        eyebrow="OPD - Token Desk"
        onClose={() => setCheckInModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleCheckInPatient} className="space-y-4">
          <Field label="Patient" required>
            <Select
              value={checkInForm.uhid}
              onChange={(event) => setCheckInForm((current) => ({ ...current, uhid: event.target.value }))}
            >
              {patients.map((patient) => (
                <option key={patient.uhid} value={patient.uhid}>
                  {patient.name} - {patient.uhid}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Consulting doctor" required>
            <Select
              value={checkInForm.doctor}
              onChange={(event) => setCheckInForm((current) => ({ ...current, doctor: event.target.value }))}
            >
              {doctors.map((doctor) => (
                <option key={doctor.name} value={doctor.name}>
                  {doctor.name} - {doctor.department}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <TicketCheck size={16} /> Generate Token
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCheckInModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(previewSlip)}
        title="Consultation slip preview"
        eyebrow={previewSlip?.organizationName ?? "OPD"}
        onClose={() => setPreviewSlip(null)}
        size="lg"
      >
        {previewLoading ? (
          <p className="rp-sub">Loading the saved appointment details...</p>
        ) : previewSlip ? (
          <div className="rounded-md border border-line bg-paper p-5">
            <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="rp-eyebrow">{previewSlip.organizationName}</p>
                <h2 className="rp-h2 !mb-1">Consultation Slip</h2>
                <p className="rp-sub !mt-0">Outpatient department visit</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted">Appointment ID</p>
                <Mono>{previewSlip.id}</Mono>
                <p className="mt-1 text-xs text-muted">{previewSlip.status}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
              <div><p className="rp-eyebrow">Patient</p><p className="font-semibold text-ink">{previewSlip.patient.name}</p><p className="rp-sub">{previewSlip.patient.uhid}</p></div>
              <div><p className="rp-eyebrow">Doctor</p><p className="font-semibold text-ink">{previewSlip.doctor.name}</p><p className="rp-sub">{previewSlip.doctor.department}</p></div>
              <div><p className="rp-eyebrow">Appointment</p><p className="font-semibold text-ink">{previewSlip.date} at {previewSlip.time}</p><p className="rp-sub">{previewSlip.mode.replaceAll("_", " ")}</p></div>
              <div><p className="rp-eyebrow">Check-in</p><p className="font-semibold text-ink">{previewSlip.checkedInAt ?? "Not checked in"}</p><p className="rp-sub">{previewSlip.patient.phone}</p></div>
            </div>
            <div className="border-t border-line pt-4"><p className="rp-eyebrow">Reason for visit</p><p className="text-sm text-ink">{previewSlip.reason || "Not recorded"}</p></div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handlePrintPreview}><Printer size={16} /> Print slip</Button>
              <Button variant="secondary" onClick={() => setPreviewSlip(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {actionMessage && (
        <Card className="mb-5 rp-card-success">
          <p className="text-sm font-medium text-[var(--rp-pine-dark)]">{actionMessage}</p>
          {issuedToken && (
            <p className="mt-1 text-xs text-[var(--rp-pine-dark)]">
              Latest token: <Mono>{issuedToken}</Mono>
            </p>
          )}
        </Card>
      )}

      <div className="rp-grid-4 mb-5">
        <Card className="rp-stat">
          <span className="rp-eyebrow">Total OPD</span>
          <div className="rp-stat-value">{queue.length}</div>
          <div className="rp-stat-delta">patients today</div>
        </Card>
        <Card className="rp-stat">
          <span className="rp-eyebrow">Waiting</span>
          <div className="rp-stat-value">{waitingCount}</div>
          <div className="rp-stat-delta">to be called</div>
        </Card>
        <Card className="rp-stat">
          <span className="rp-eyebrow">In Consultation</span>
          <div className="rp-stat-value">{consultingCount}</div>
          <div className="rp-stat-delta">with doctors</div>
        </Card>
        <Card className="rp-stat">
          <span className="rp-eyebrow">Completed</span>
          <div className="rp-stat-value">{completedCount}</div>
          <div className="rp-stat-delta">closed visits</div>
        </Card>
      </div>

      <Card className="mb-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
          <Field label="Search OPD queue">
            <div className="relative">
              <Search size={15} className="rp-input-icon" />
              <Input
                className="!pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Token, patient, doctor or department"
              />
            </div>
          </Field>
          <Field label="Department">
            <Select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="All">All departments</option>
              {opdDepartments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All statuses" : item}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <Card>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="rp-h2 !mb-0">Live OPD queue</h2>
              <p className="rp-sub !mt-1">{filteredQueue.length} matching visit{filteredQueue.length === 1 ? "" : "s"}.</p>
            </div>
            <Badge tone="amber">{activeQueue.length} active</Badge>
          </div>

          {filteredQueue.length === 0 ? (
            <EmptyState
              title="No OPD visits found"
              description="Adjust filters or check in a patient to add them to the OPD queue."
            />
          ) : (
            <Table columns={["Token", "Patient", "Department", "Doctor", "Wait", "Status", "Actions"]}>
              {filteredQueue.map((entry) => (
                <tr key={entry.token}>
                  <td><Mono>{entry.token}</Mono></td>
                  <td className="font-medium text-[var(--rp-ink)]">{entry.patient}</td>
                  <td>{entry.department}</td>
                  <td>{entry.doctor}</td>
                  <td>{entry.status === "Completed" ? "-" : waitLabel(entry.checkedInAt)}</td>
                  <td><Badge tone={statusTone[entry.status]}>{entry.status}</Badge></td>
                  <td>
                    <div className="flex gap-1.5">
                      {entry.status === "Waiting" && (
                        <button className="rp-icon-btn" title="Call patient" onClick={() => handleCall(entry)}>
                          <PhoneCall size={14} />
                        </button>
                      )}
                      {entry.status !== "Completed" && (
                        <button
                          className="rp-icon-btn"
                          title={entry.status === "Waiting" ? "Move to consultation" : "Mark completed"}
                          onClick={() => handleAdvance(entry)}
                        >
                          {entry.status === "Waiting" ? <PlayCircle size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                      )}
                      <button className="rp-icon-btn" title="Print consultation slip" onClick={() => handleSlip(entry)}>
                        <Printer size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Doctor load</h2>
              <Badge tone="slate">{todayLabel}</Badge>
            </div>
            {doctorLoad.length === 0 ? (
              <p className="rp-sub">No doctor queue load yet.</p>
            ) : (
              <ul className="rp-list">
                {doctorLoad.map(({ doctor, waiting, consulting, completed }) => (
                  <li key={doctor.name} className="rp-list-row !items-start !py-2">
                    <div className="min-w-0 flex-1">
                      <p className="rp-list-title truncate">{doctor.name}</p>
                      <p className="rp-list-sub truncate">{doctor.department}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {waiting > 0 && <Badge tone="amber">{waiting} waiting</Badge>}
                      {consulting > 0 && <Badge tone="pine">{consulting} active</Badge>}
                      {completed > 0 && <Badge tone="slate">{completed} done</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <FileText size={16} className="text-[var(--rp-pine)]" />
              <h2 className="text-sm font-semibold text-ink">Department summary</h2>
            </div>
            <ul className="rp-list">
              {departmentSummary.map((item) => (
                <li key={item.department} className="rp-list-row !py-2">
                  <div className="min-w-0 flex-1">
                    <p className="rp-list-title truncate">{item.department}</p>
                    <p className="rp-list-sub">{item.active} active OPD visit{item.active === 1 ? "" : "s"}</p>
                  </div>
                  <Badge tone={item.total > 0 ? "pine" : "slate"}>{item.total}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Printer size={16} className="text-[var(--rp-pine)]" />
              <h2 className="text-sm font-semibold text-ink">Consultation slips</h2>
            </div>
            <p className="rp-sub mb-3">Slip includes token, department, doctor, patient name and check-in time.</p>
            <Button
              variant="secondary"
              onClick={handlePreviewTemplate}
              disabled={previewLoading}
            >
              <Printer size={16} /> {previewLoading ? "Loading preview..." : "Preview template"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
