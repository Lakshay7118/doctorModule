"use client";

import * as React from "react";
import { CalendarPlus, Check, RotateCcw, X } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Mono, SectionHeader, Select, Table } from "./ui";
import { TimePicker } from "@/components/ui";
import { useReceptionistData } from "./data-context";
import {
  formatReceptionistDate,
  isPastReceptionistAppointment,
  nextBookableReceptionistTime,
  parseReceptionistDate,
  todayIso,
  tomorrowIso,
} from "./date-utils";

const statusTone: Record<string, "pine" | "amber" | "coral" | "slate"> = {
  Confirmed: "pine",
  Pending: "amber",
  Cancelled: "coral",
  Completed: "slate",
};

export function Appointments() {
  const { appointments, doctors, patients, addAppointment, updateAppointmentStatus } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const today = todayIso();
  const todayLabel = formatReceptionistDate(today);
  const nextBookableTime = nextBookableReceptionistTime();
  const [form, setForm] = React.useState({
    uhid: patients[0]?.uhid ?? "",
    doctor: doctors[0]?.name ?? "",
    date: tomorrowIso(),
    time: nextBookableTime,
  });
  const isPastSlot = isPastReceptionistAppointment(form.date, form.time);

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      uhid: current.uhid || patients[0]?.uhid || "",
      doctor: current.doctor || doctors[0]?.name || "",
    }));
  }, [doctors, patients]);

  function handleBook(event: React.FormEvent) {
    event.preventDefault();
    if (isPastReceptionistAppointment(form.date, form.time)) return;

    const patient = patients.find((item) => item.uhid === form.uhid);
    if (!patient) return;

    const doctor = doctors.find((item) => item.name === form.doctor);
    if (!doctor) return;
    addAppointment({
      patient: patient.name,
      uhid: patient.uhid,
      doctor: doctor.name,
      department: doctor.department,
      date: form.date,
      time: form.time,
      status: "Confirmed",
    });
    setModalOpen(false);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Appointments"
        title="Appointment management"
        description="Book, reschedule, cancel and manage appointments while checking doctor availability."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <CalendarPlus size={16} /> New Appointment
          </Button>
        }
      />

      <Modal open={modalOpen} title="Book Appointment" eyebrow="Appointment Management" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleBook} className="space-y-4">
          <Field label="Patient" required>
            <Select value={form.uhid} onChange={(event) => setForm((current) => ({ ...current, uhid: event.target.value }))}>
              {patients.map((patient) => (
                <option key={patient.uhid} value={patient.uhid}>{patient.name} - {patient.uhid}</option>
              ))}
            </Select>
          </Field>
          <Field label="Doctor" required hint="Department is set automatically based on the doctor">
            <Select value={form.doctor} onChange={(event) => setForm((current) => ({ ...current, doctor: event.target.value }))}>
              {doctors.map((doctor) => (
                <option key={doctor.name} value={doctor.name}>{doctor.name} - {doctor.department}</option>
              ))}
            </Select>
          </Field>
          <div className="rp-grid-2">
            <Field label="Date" required>
              <Input type="date" min={today} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
            </Field>
            <Field label="Time" required>
              <TimePicker
                value={form.time}
                onChange={(value) => setForm((current) => ({ ...current, time: value }))}
                format="12h"
                ariaLabel="Reception appointment time"
              />
            </Field>
          </div>
          {isPastSlot && (
            <p className="rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">
              Select a future time for today, or choose a later appointment date.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isPastSlot}>
              <CalendarPlus size={16} /> Confirm appointment
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="rp-h2 !mb-0">All appointments</h2>
              <p className="rp-sub !mt-1">{appointments.length} appointments in the front desk list.</p>
            </div>
            <Badge tone="pine">{appointments.filter((appointment) => appointment.status === "Confirmed").length} confirmed</Badge>
          </div>
          <Table columns={["ID", "Patient", "Doctor", "Date", "Time", "Status", "Actions"]}>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td><Mono>{appointment.id}</Mono></td>
                <td className="font-medium text-ink">{appointment.patient}</td>
                <td>{appointment.doctor}</td>
                <td>{appointment.date}</td>
                <td><Mono>{appointment.time}</Mono></td>
                <td><Badge tone={statusTone[appointment.status]}>{appointment.status}</Badge></td>
                <td>
                  <div className="flex gap-1.5">
                    {appointment.status !== "Completed" && appointment.status !== "Cancelled" && (
                      <button className="rp-icon-btn" title="Mark completed" onClick={() => updateAppointmentStatus(appointment.id, "Completed")}>
                        <Check size={14} />
                      </button>
                    )}
                    {appointment.status === "Pending" && (
                      <button className="rp-icon-btn" title="Confirm" onClick={() => updateAppointmentStatus(appointment.id, "Confirmed")}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {appointment.status !== "Cancelled" && appointment.status !== "Completed" && (
                      <button className="rp-icon-btn rp-icon-btn-danger" title="Cancel" onClick={() => updateAppointmentStatus(appointment.id, "Cancelled")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card className="xl:sticky xl:top-24">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Doctor availability today</h2>
            <Badge tone="slate">{todayLabel}</Badge>
          </div>
          <ul className="rp-list">
            {doctors.map((doctor) => {
              const count = appointments.filter((appointment) => appointment.doctor === doctor.name && parseReceptionistDate(appointment.date) === today && appointment.status !== "Cancelled").length;
              return (
                <li key={doctor.name} className="rp-list-row !py-2">
                  <div className="min-w-0 flex-1">
                    <p className="rp-list-title truncate">{doctor.name}</p>
                    <p className="rp-list-sub truncate">{doctor.department}</p>
                  </div>
                  <Badge tone={count > 3 ? "amber" : "pine"}>{count}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
