"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  LifeBuoy,
  MapPin,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { useMode } from "@/lib/mode-context";
import {
  ClinicQueueItem,
  DoctorShift,
  DoctorTaskItem,
  HospitalWorkItem,
  shiftTypeLabel,
  Workplace,
} from "@/lib/doctor-workflow-types";

export function WorkplaceBadge({ workplace }: { workplace?: Workplace }) {
  if (!workplace) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-1 text-[11px] font-semibold text-ink-muted">
      <MapPin size={11} />
      {workplace.type === "online"
        ? "Online Consultation"
        : `${workplace.name}${workplace.location ? ` - ${workplace.location}` : ""}`}
    </span>
  );
}

export function ShiftCard({
  shift,
  workplace,
  onClick,
}: {
  shift: DoctorShift;
  workplace?: Workplace;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      <Card className="!p-4 hover:border-brand-100 hover:bg-brand-50/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{workplace?.name ?? "Workplace"}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {workplace?.location ?? workplace?.department ?? "Online"}
            </p>
          </div>
          <Pill tone={shift.status === "active" ? "sage" : shift.status === "completed" ? "neutral" : "brand"}>
            {shift.status}
          </Pill>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-ink-muted">
            {shift.startTime} - {shift.endTime}
          </p>
          <p className="text-xs font-semibold text-ink-soft">{shiftTypeLabel(shift.shiftType)}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill tone={shift.bookingEnabled ? "sage" : "neutral"}>
            {shift.bookingEnabled ? "Booking enabled" : "Booking closed"}
          </Pill>
          {shift.slotMinutes && <Pill tone="neutral">{shift.slotMinutes} min slots</Pill>}
          {shift.bufferMinutes ? <Pill tone="neutral">{shift.bufferMinutes} min buffer</Pill> : null}
          {shift.note && <span className="text-[11px] text-alert-500">{shift.note}</span>}
        </div>
      </Card>
    </button>
  );
}

export function ActiveShiftBanner({
  shift,
  workplace,
}: {
  shift?: DoctorShift;
  workplace?: Workplace;
}) {
  if (!shift || !workplace) return null;
  return (
    <div className="rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-brand-700">Active Shift</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {workplace.name}
            {workplace.location ? ` - ${workplace.location}` : ""}
          </p>
          <p className="text-xs text-ink-muted">
            {shiftTypeLabel(shift.shiftType)} - {shift.startTime} to {shift.endTime}
          </p>
        </div>
        <Pill tone="sage">
          <CheckCircle2 size={11} /> Active
        </Pill>
      </div>
    </div>
  );
}

export function ClinicQueueCard({
  item,
  onStart,
  onComplete,
}: {
  item: ClinicQueueItem;
  onStart: () => void;
  onComplete: () => void;
}) {
  const { patients } = useDoctorWorkflow();
  const patient = patients.find((entry) => entry.id === item.patientId);
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-muted">#{item.token}</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">{patient?.name ?? "Patient"}</h3>
          <p className="text-xs text-ink-muted">{item.appointmentTime} - {item.reason}</p>
          <p className="mt-2 text-xs text-clay-600">Waiting {item.waitingMins} min</p>
        </div>
        <Pill tone={item.status === "in_consultation" ? "sage" : item.status === "waiting" ? "clay" : "neutral"}>
          {item.status.replace("_", " ")}
        </Pill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/doctor/patients/${item.patientId}`} className="btn-secondary text-xs">
          Open Patient
        </Link>
        {item.status !== "completed" && (
          <Link
            href={`/doctor/consultation?patient=${item.patientId}&appointment=${item.id}`}
            onClick={onStart}
            className="btn-primary text-xs"
          >
            Start Consultation
          </Link>
        )}
        {item.status === "in_consultation" && (
          <button onClick={onComplete} className="btn-secondary text-xs">
            Complete
          </button>
        )}
      </div>
    </Card>
  );
}

export function HospitalPatientCard({
  item,
  onAccept,
  onComplete,
}: {
  item: HospitalWorkItem;
  onAccept?: () => void;
  onComplete?: () => void;
}) {
  const { patients } = useDoctorWorkflow();
  const patient = patients.find((entry) => entry.id === item.patientId);
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
            <Bed size={12} /> Bed {item.bed}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">{patient?.name ?? "Patient"}</h3>
          <p className="text-xs text-ink-muted">Age {patient?.age ?? "-"} - {item.diagnosis}</p>
        </div>
        <Pill tone={item.priority === "Critical" ? "alert" : item.priority === "High" ? "clay" : "neutral"}>
          {item.priority}
        </Pill>
      </div>
      <div className="mt-3 rounded-md border border-line bg-paper px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Why assigned</p>
        <p className="mt-1 text-xs text-ink-soft">{item.reasonAssigned}</p>
        {item.requestedBy && <p className="mt-1 text-xs text-ink-muted">Requested by {item.requestedBy}</p>}
      </div>
      {item.pending && item.pending.length > 0 && (
        <div className="mt-3 space-y-1">
          {item.pending.map((pending) => (
            <p key={pending} className="text-xs text-ink-muted">
              - {pending}
            </p>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.status === "request" && onAccept && (
          <button onClick={onAccept} className="btn-primary text-xs">
            Accept
          </button>
        )}
        <Link href={`/doctor/patients/${item.patientId}/encounter/${item.id}`} className="btn-secondary text-xs">
          Review Patient <ArrowRight size={13} />
        </Link>
        {item.status !== "completed" && onComplete && (
          <button onClick={onComplete} className="btn-ghost text-xs">
            Complete
          </button>
        )}
      </div>
    </Card>
  );
}

export function DoctorTaskCard({
  task,
  workplace,
  onStart,
  onComplete,
}: {
  task: DoctorTaskItem;
  workplace?: Workplace;
  onStart: () => void;
  onComplete: () => void;
}) {
  const { patients } = useDoctorWorkflow();
  const patient = task.patientId ? patients.find((entry) => entry.id === task.patientId) : undefined;
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{task.title}</h3>
          <p className="mt-1 text-xs text-ink-muted">{patient?.name ?? workplace?.name ?? "Operational task"}</p>
        </div>
        <Pill tone={task.priority === "Critical" || task.priority === "High" ? "alert" : "neutral"}>
          {task.priority}
        </Pill>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-muted sm:grid-cols-2">
        <p>
          <Clock size={12} className="mr-1 inline" />
          {task.dueTime}
        </p>
        <p>{workplace?.name}</p>
        <p>Source: {task.source}</p>
        <p>Assigned by: {task.assignedBy}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {task.status !== "completed" && (
          <>
            <button onClick={onStart} className="btn-secondary text-xs">
              Start
            </button>
            <button onClick={onComplete} className="btn-primary text-xs">
              Complete
            </button>
          </>
        )}
        {task.patientId && (
          <Link
            href={task.appointmentId ? `/doctor/consultation?patient=${task.patientId}&appointment=${task.appointmentId}` : `/doctor/patients/${task.patientId}`}
            className="btn-ghost text-xs"
          >
            {task.appointmentId ? "Open Consultation" : "Open Patient"}
          </Link>
        )}
      </div>
    </Card>
  );
}

export function ConflictNotice({ conflicts }: { conflicts: Array<[DoctorShift, DoctorShift]> }) {
  if (conflicts.length === 0) return null;
  const [a, b] = conflicts[0];
  return (
    <Card className="border-alert-100 bg-alert-50">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 text-alert-500" />
        <div>
          <h2 className="font-display text-lg text-ink">Schedule Conflict</h2>
          <p className="mt-1 text-sm text-ink-soft">These shifts overlap. Please edit one shift before publishing availability.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <p>
              <CalendarClock size={12} className="mr-1 inline" />
              {a.startTime} - {a.endTime}
            </p>
            <p>
              <CalendarClock size={12} className="mr-1 inline" />
              {b.startTime} - {b.endTime}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

type AiOperation = "normal" | "clinic" | "doctor" | "emergency";

const aiOperations: Array<{
  id: AiOperation;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}> = [
  {
    id: "normal",
    label: "Normal Query",
    description: "Education, navigation and next-step guidance.",
    icon: MessageSquareText,
  },
  {
    id: "clinic",
    label: "Clinic Knowledge",
    description: "Timings, services, facilities and policy facts.",
    icon: Building2,
  },
  {
    id: "doctor",
    label: "Doctor Knowledge",
    description: "Profile, specialty, availability and instructions.",
    icon: UserRound,
  },
  {
    id: "emergency",
    label: "Emergency Routing",
    description: "High-risk detection, escalation and audit path.",
    icon: ShieldAlert,
  },
];

function buildAiResponse({
  operation,
  query,
  activeWorkplaceName,
  currentDoctorName,
  activeShift,
  pendingQueueCount,
  urgentTaskCount,
  criticalHospitalCount,
}: {
  operation: AiOperation;
  query: string;
  activeWorkplaceName: string;
  currentDoctorName: string;
  activeShift?: DoctorShift;
  pendingQueueCount: number;
  urgentTaskCount: number;
  criticalHospitalCount: number;
}) {
  const trimmedQuery = query.trim();
  const subject = trimmedQuery || "No query entered";

  if (operation === "clinic") {
    return {
      title: "Clinic Knowledge AI",
      summary: `${activeWorkplaceName} answers are scoped to the currently selected workplace and its approved records.`,
      route: "Clinic AI / receptionist",
      steps: [
        `Current workplace: ${activeWorkplaceName}.`,
        "Use the selected workplace records for timings, services, locations and policy facts.",
        `Open queue waiting: ${pendingQueueCount}.`,
        "If the question asks for a specific doctor's slot, switch to Doctor Knowledge.",
      ],
      boundary: "Do not invent prices, availability or policies that are not in clinic data.",
      subject,
    };
  }

  if (operation === "doctor") {
    return {
      title: "Doctor Knowledge AI",
      summary: `${currentDoctorName} knowledge is scoped to the signed-in doctor's profile, approved content and schedule.`,
      route: "Responsible doctor / assigned team",
      steps: [
        `Responsible doctor: ${currentDoctorName}.`,
        activeShift
          ? `Active context: ${activeWorkplaceName}, ${activeShift.startTime} to ${activeShift.endTime}.`
          : `Current context: ${activeWorkplaceName}.`,
        `Queue waiting: ${pendingQueueCount}; urgent tasks: ${urgentTaskCount}.`,
        "For another doctor's schedule or content, switch context before answering.",
      ],
      boundary: "Never answer Doctor A facts using Doctor B data.",
      subject,
    };
  }

  if (operation === "emergency") {
    return {
      title: "Emergency AI Routing",
      summary: "Route the patient to immediate safety guidance and alert the configured clinical team.",
      route: "Emergency safety flow",
      steps: [
        "Detect high-risk language and avoid open-ended chat.",
        "Tell the patient to seek urgent emergency care when symptoms suggest immediate risk.",
        "Notify the responsible doctor where configured.",
        "Fallback to the clinic clinical team if the doctor is unavailable.",
        `Open high-risk work right now: ${criticalHospitalCount} critical hospital item(s), ${urgentTaskCount} urgent task(s).`,
        "Record acknowledgement and handoff for audit.",
      ],
      boundary: "Do not promise that a specific doctor is available during an emergency.",
      subject,
    };
  }

  return {
    title: "Normal Query AI",
    summary: "Interpret the request, provide safe general guidance, then route to verified Qlyno records or a human owner.",
    route: "Qlyno navigation / human handoff when needed",
    steps: [
      "Classify intent as education, booking, records, follow-up, report, prescription or staff message.",
      "Use deterministic Qlyno data for people, prices, availability and records.",
      "Offer booking, patient record, report, prescription or task navigation when relevant.",
      "Hand off clinical judgement or private patient decisions to the doctor/team.",
    ],
    boundary: "AI can explain and route, but it must not invent medical facts or make diagnosis decisions.",
    subject,
  };
}

export function DoctorAiAssistant() {
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<AiOperation>("normal");
  const [query, setQuery] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const { workContext } = useMode();
  const { activeShift, clinicQueue, currentDoctorName, doctorTasks, hospitalWorklist, workplaces } = useDoctorWorkflow();

  const activeWorkplace = useMemo(() => {
    if (activeShift) return workplaces.find((workplace) => workplace.id === activeShift.workplaceId);
    return workplaces.find((workplace) => (workContext === "hospital" ? workplace.type === "hospital" : workplace.type !== "hospital"));
  }, [activeShift, workContext, workplaces]);

  const response = useMemo(
    () =>
      buildAiResponse({
        operation,
        query,
        activeWorkplaceName: activeWorkplace?.name ?? "Current workspace",
        currentDoctorName,
        activeShift,
        pendingQueueCount: clinicQueue.filter((item) => item.status === "waiting").length,
        urgentTaskCount: doctorTasks.filter((task) => task.priority === "Critical" || task.status === "urgent").length,
        criticalHospitalCount: hospitalWorklist.filter((item) => item.priority === "Critical" || item.status === "critical").length,
      }),
    [activeShift, activeWorkplace?.name, clinicQueue, currentDoctorName, doctorTasks, hospitalWorklist, operation, query]
  );

  const ActiveIcon = aiOperations.find((item) => item.id === operation)?.icon ?? Sparkles;

  function queueAction(label: string) {
    setActionMessage(`${label} queued in ${activeWorkplace?.name ?? "current workspace"}.`);
  }

  return (
    <div className="fixed inset-x-3 bottom-6 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6">
      {open && (
        <div
          data-testid="doctor-ai-assistant-panel"
          className="max-h-[calc(100dvh-8.5rem)] w-full overflow-hidden rounded-card border border-line bg-white shadow-pop sm:w-[28rem] md:w-[30rem]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line bg-ink px-3 py-3 text-white sm:px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-brand-700">
                <BrainCircuit size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-100">Qlyno AI</p>
                <h2 className="truncate font-display text-lg leading-tight">Care Assistant</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI assistant"
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto p-3 sm:max-h-[calc(100dvh-13.5rem)] sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {aiOperations.map((item) => {
                const Icon = item.icon;
                const active = operation === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOperation(item.id);
                      setActionMessage("");
                    }}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      active ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-soft hover:bg-paper"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon size={14} />
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-ink-muted">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="eyebrow">Patient or staff request</span>
              <textarea
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActionMessage("");
                }}
                rows={3}
                placeholder="Example: Patient has chest pain, who should be alerted?"
                className="input-field mt-1.5 resize-none"
              />
            </label>

            <div className="mt-4 rounded-card border border-line bg-paper/70 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    operation === "emergency" ? "bg-alert-50 text-alert-500" : "bg-brand-50 text-brand-700"
                  }`}
                >
                  <ActiveIcon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{response.title}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">{response.summary}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    Route: {response.route}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {response.steps.map((step) => (
                  <p key={step} className="flex gap-2 text-xs leading-5 text-ink-muted">
                    <CheckCircle2 size={12} className="mt-1 shrink-0 text-sage-500" />
                    <span>{step}</span>
                  </p>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-line bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Boundary</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{response.boundary}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link href="/discover" className="btn-secondary text-xs">
                <LifeBuoy size={13} /> Search
              </Link>
              <Link href="/doctor/schedule" className="btn-secondary text-xs">
                <CalendarClock size={13} /> Schedule
              </Link>
              <button type="button" onClick={() => queueAction("Human handoff")} className="btn-secondary text-xs">
                <Stethoscope size={13} /> Handoff
              </button>
              <button
                type="button"
                onClick={() => queueAction(operation === "emergency" ? "Emergency escalation" : "AI action")}
                className={operation === "emergency" ? "btn-primary bg-alert-500 hover:bg-alert-600 text-xs" : "btn-primary text-xs"}
              >
                <Send size={13} /> Run
              </button>
            </div>

            {actionMessage && (
              <p className="mt-3 rounded-md border border-sage-100 bg-sage-50 px-3 py-2 text-xs font-medium text-sage-500">
                {actionMessage}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open Qlyno AI assistant"
        data-testid="doctor-ai-assistant-trigger"
        className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-ink text-white shadow-pop transition-all hover:-translate-y-0.5 hover:shadow-lift sm:h-16 sm:w-16"
      >
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-clay-300 text-[10px] font-bold text-ink">
          AI
        </span>
        <Bot size={25} className="transition-transform group-hover:scale-105 sm:size-[27px]" />
      </button>
    </div>
  );
}
