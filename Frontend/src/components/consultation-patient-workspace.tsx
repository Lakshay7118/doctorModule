"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Search, Stethoscope, UserRound } from "lucide-react";
import { Avatar, Card, EmptyState, ListSkeleton, Pill, SectionHeading, SectionSkeleton } from "@/components/ui";
import { ConsultationForm } from "@/components/doctor-consultation-form";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { currentDoctor, patientInWorkContext, patients as seedPatients } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import type { Appointment, Patient } from "@/lib/types";

const tagTone: Record<string, "brand" | "clay" | "alert" | "sage"> = {
  New: "brand",
  "Follow-up": "clay",
  Critical: "alert",
  "Shared-care": "sage",
};

function appointmentStatusTone(status: Appointment["status"]): "brand" | "clay" | "alert" | "sage" | "neutral" {
  if (status === "Completed") return "sage";
  if (status === "In Consultation") return "brand";
  if (status === "Checked In") return "clay";
  if (status === "Cancelled" || status === "No Show") return "alert";
  return "neutral";
}

function compareConsultations(a: Appointment, b: Appointment) {
  const aCompleted = a.status === "Completed";
  const bCompleted = b.status === "Completed";
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function PatientConsultationPicker({
  appointments,
  isLoading,
  onComplete,
  onStart,
  patients,
  query,
  setQuery,
  syncMessage,
}: {
  appointments: Appointment[];
  isLoading: boolean;
  onComplete: (appointmentId: string) => void;
  onStart: (appointmentId: string) => void;
  patients: Patient[];
  query: string;
  setQuery: (value: string) => void;
  syncMessage: string;
}) {
  const consultationRows = appointments
    .filter((appointment) => appointment.status !== "Cancelled" && appointment.status !== "No Show")
    .map((appointment) => ({
      appointment,
      patient: patients.find((patient) => patient.id === appointment.patientId),
    }))
    .filter(({ appointment, patient }) => {
      if (!patient) return false;
      const q = query.trim().toLowerCase();
      return (
        !q ||
        patient.name.toLowerCase().includes(q) ||
        patient.mrn.toLowerCase().includes(q) ||
        patient.phone.toLowerCase().includes(q) ||
        patient.conditions.some((condition) => condition.toLowerCase().includes(q)) ||
        appointment.reason.toLowerCase().includes(q) ||
        appointment.status.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => compareConsultations(a.appointment, b.appointment));

  const activeRows = consultationRows.filter(({ appointment }) => appointment.status !== "Completed");
  const completedRows = consultationRows.filter(({ appointment }) => appointment.status === "Completed");

  const legacyPatientRows = patients.filter((patient) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      patient.name.toLowerCase().includes(q) ||
      patient.mrn.toLowerCase().includes(q) ||
      patient.phone.toLowerCase().includes(q) ||
      patient.conditions.some((condition) => condition.toLowerCase().includes(q))
    );
  });

  function renderAppointmentRow({ appointment, patient }: { appointment: Appointment; patient?: Patient }) {
    if (!patient) return null;
    const isCompleted = appointment.status === "Completed";
    const href = `/doctor/consultation?patient=${patient.id}&appointment=${appointment.id}`;

    return (
      <div
        key={appointment.id}
        className="grid gap-4 px-5 py-4 transition-colors hover:bg-brand-50/30 lg:grid-cols-[minmax(0,1fr)_220px_220px]"
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar initials={patient.avatarInitials} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-ink">{patient.name}</h2>
              <span className="font-mono text-[11px] text-ink-faint">{patient.mrn}</span>
              <Pill tone={appointmentStatusTone(appointment.status)}>{appointment.status}</Pill>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {patient.age} yrs - {patient.gender} - Blood group {patient.bloodGroup}
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">{appointment.reason}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.conditions.length > 0 ? (
                patient.conditions.slice(0, 3).map((condition) => (
                  <Pill key={condition} tone="brand">
                    {condition}
                  </Pill>
                ))
              ) : (
                <Pill tone="neutral">No active conditions</Pill>
              )}
              {patient.tags?.map((tag) => (
                <Pill key={tag} tone={tagTone[tag] ?? "neutral"}>
                  {tag}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:block lg:space-y-1">
          <p className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink-muted">
            <CalendarClock size={12} className="mr-1 inline" />
            {appointment.date}
          </p>
          <p className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink-muted">{appointment.time}</p>
          <p className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink-muted">{appointment.type}</p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          {patient.allergies.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-alert-100 bg-alert-50 px-2 py-1 text-xs font-semibold text-alert-500">
              <AlertTriangle size={13} />
              Allergy
            </span>
          )}
          <Link
            href={href}
            onClick={() => {
              if (!isCompleted && appointment.status !== "In Consultation") onStart(appointment.id);
            }}
            className="btn-secondary text-xs"
          >
            <Stethoscope size={13} /> {appointment.status === "In Consultation" ? "Open" : isCompleted ? "View" : "Start"}
          </Link>
          {!isCompleted && (
            <button type="button" onClick={() => onComplete(appointment.id)} className="btn-secondary text-xs">
              <CheckCircle2 size={13} /> Complete
            </button>
          )}
          <ChevronRight size={16} className="text-ink-faint" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        eyebrow="05 - Consultation"
        title="Consultations"
        description="Open active consultation appointments, complete them from the same workflow, and keep completed consultations below the active list."
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patient by name, MRN, phone or condition"
            className="input-field pl-9"
          />
        </div>
        {syncMessage && <p className="text-xs text-ink-muted">{syncMessage}</p>}
      </div>

      {isLoading ? (
        <>
          <SectionSkeleton action={false} />
          <ListSkeleton rows={7} />
        </>
      ) : consultationRows.length === 0 && legacyPatientRows.length === 0 ? (
        <Card>
          <EmptyState title="No consultations found" description="Try another name, MRN, reason or appointment status." />
        </Card>
      ) : consultationRows.length > 0 ? (
        <div className="space-y-6">
          {activeRows.length > 0 ? (
            <Card padded={false}>
              <div className="divide-y divide-line">{activeRows.map(renderAppointmentRow)}</div>
            </Card>
          ) : (
            <Card>
              <EmptyState title="No active consultations" description="Active appointment consultations will appear here." />
            </Card>
          )}

          {completedRows.length > 0 && (
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage-500">Completed</p>
              <Card padded={false}>
                <div className="divide-y divide-line">{completedRows.map(renderAppointmentRow)}</div>
              </Card>
            </section>
          )}
        </div>
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-line">
            {legacyPatientRows.map((patient) => {
              const vitals = patient.latestVitals;

              return (
                <Link
                  key={patient.id}
                  href={`/doctor/consultation?patient=${patient.id}`}
                  className="group grid gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40 lg:grid-cols-[minmax(0,1fr)_220px_140px]"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <Avatar initials={patient.avatarInitials} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-ink group-hover:text-brand-700">{patient.name}</h2>
                        <span className="font-mono text-[11px] text-ink-faint">{patient.mrn}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {patient.age} yrs - {patient.gender} - Blood group {patient.bloodGroup}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-faint">{currentDoctor.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {patient.conditions.length > 0 ? (
                          patient.conditions.slice(0, 3).map((condition) => (
                            <Pill key={condition} tone="brand">
                              {condition}
                            </Pill>
                          ))
                        ) : (
                          <Pill tone="neutral">No active conditions</Pill>
                        )}
                        {patient.tags?.map((tag) => (
                          <Pill key={tag} tone={tagTone[tag] ?? "neutral"}>
                            {tag}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:block lg:space-y-1">
                    {vitals ? (
                      <>
                        <p className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink-muted">BP {vitals.bp}</p>
                        <p className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink-muted">
                          Pulse {vitals.pulse} bpm
                        </p>
                        <p className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink-muted">SpO2 {vitals.spo2}%</p>
                      </>
                    ) : (
                      <p className="text-xs text-ink-muted">No vitals recorded</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    {patient.allergies.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-alert-100 bg-alert-50 px-2 py-1 text-xs font-semibold text-alert-500">
                        <AlertTriangle size={13} />
                        Allergy
                      </span>
                    )}
                    <span className="btn-secondary text-xs">
                      <Stethoscope size={13} /> Start
                    </span>
                    <ChevronRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export function ConsultationPatientWorkspace({
  initialAppointmentId,
  initialPatientId,
}: {
  initialAppointmentId?: string;
  initialPatientId?: string;
}) {
  const { workContext } = useMode();
  const {
    appointments,
    completeQueueConsultation,
    doctors,
    isLoadingWorkflow,
    patients: workflowPatients,
    startQueueConsultation,
  } = useDoctorWorkflow();
  const [query, setQuery] = useState("");
  const patients = workflowPatients.length > 0 ? workflowPatients : seedPatients;
  const activeDoctors = doctors.length > 0 ? doctors : [currentDoctor];
  const selectedAppointment = initialAppointmentId ? appointments.find((appointment) => appointment.id === initialAppointmentId) : undefined;
  const appointmentWorkplaceId = selectedAppointment?.workplaceId;
  const appointmentReason = selectedAppointment?.reason ?? "";
  const syncMessage = appointments.length > 0 ? "Loaded consultation appointments." : "No appointment consultations loaded.";

  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const consultationPatients = contextPatients.length > 0 ? contextPatients : patients;
  const consultationPatientIds = useMemo(
    () => new Set(consultationPatients.map((patient) => patient.id)),
    [consultationPatients]
  );
  const consultationAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => consultationPatientIds.has(appointment.patientId))
        .sort(compareConsultations),
    [appointments, consultationPatientIds]
  );
  const selectedPatient = initialPatientId
    ? consultationPatients.find((patient) => patient.id === initialPatientId)
      ?? patients.find((patient) => patient.id === initialPatientId)
    : undefined;

  if (initialPatientId && selectedPatient) {
    return (
      <div>
        <div className="mb-4">
          <Link href="/doctor/consultation" className="btn-secondary">
            <UserRound size={14} /> All Patients
          </Link>
        </div>
        <ConsultationForm
          patients={consultationPatients}
          appointmentId={initialAppointmentId}
          workplaceId={appointmentWorkplaceId}
          preselectedPatientId={selectedPatient.id}
          initialComplaint={appointmentReason}
          labOrderMode="modal"
          prescriptionMode="modal"
        />
      </div>
    );
  }

  return (
    <PatientConsultationPicker
      appointments={consultationAppointments}
      isLoading={isLoadingWorkflow}
      onComplete={completeQueueConsultation}
      onStart={startQueueConsultation}
      patients={consultationPatients}
      query={query}
      setQuery={setQuery}
      syncMessage={activeDoctors.length > 0 ? syncMessage : ""}
    />
  );
}
