"use client";

import * as React from "react";
import {
  CalendarCheck,
  UserPlus,
  Users,
  BedDouble,
  AlarmClock,
  Siren,
} from "lucide-react";
import { Card, SectionHeader, StatCard, Badge, Mono } from "./ui";
import { useReceptionistData } from "./data-context";
import { formatReceptionistDate, parseReceptionistDate, todayIso } from "./date-utils";

const statusTone: Record<string, "pine" | "amber" | "coral" | "slate"> = {
  Waiting: "amber",
  "In Consultation": "pine",
  Completed: "slate",
};

export function Dashboard() {
  const { context, patients, appointments, queue, admissions, followUps, tasks, coordination } = useReceptionistData();

  const today = todayIso();
  const todayLabel = formatReceptionistDate(today);
  const todaysAppointments = appointments.filter((a) => parseReceptionistDate(a.date) === today);
  const waiting = queue.filter((q) => q.status === "Waiting").length;
  const inConsultation = queue.filter((q) => q.status === "In Consultation").length;
  const newToday = patients.filter((p) => p.status === "New" && parseReceptionistDate(p.lastVisit) === today).length;
  const admittedNow = admissions.filter((a) => a.status === "Admitted").length;
  const pendingFollowUps = followUps.filter((item) => item.status === "Due Today" || item.status === "Overdue").length;
  const openTasks = tasks.filter((task) => task.status !== "Completed").length;
  const isHospital = context.type === "hospital";
  const isSolo = context.type === "solo-doctor";

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Live - ${todayLabel}`}
        title="Good afternoon, reception."
        description={
          isHospital
            ? "Appointments, arrivals, admissions, emergency routing and active hospital front-desk work."
            : isSolo
              ? "Today's appointments, arrivals, single-doctor queue, follow-ups and practice messages."
              : "Clinic appointments, doctor-wise queues, arrivals, follow-ups, lab/pharmacy status and messages."
        }
      />

      {/* Signature element: a token ticker, like the physical display board at a hospital reception desk */}
      <Card className="rp-ticker">
        <div className="rp-ticker-label">
          <AlarmClock size={16} strokeWidth={2} />
          Now serving
        </div>
        <div className="rp-ticker-row">
          {queue.slice(0, 6).map((q) => (
            <div key={q.token} className={`rp-ticker-chip rp-ticker-chip-${statusTone[q.status]}`}>
              <Mono>{q.token}</Mono>
              <span>{q.department}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="rp-grid-4 mt-5">
        <StatCard label="Appointments today" value={todaysAppointments.length} delta={`${appointments.filter(a=>a.status==="Confirmed").length} confirmed`} tone="pine" icon={<CalendarCheck size={16} />} />
        <StatCard label="Patients waiting" value={waiting} delta={`${inConsultation} in consultation`} tone="amber" icon={<Users size={16} />} />
        <StatCard label="New registrations" value={newToday} delta="today" tone="pine" icon={<UserPlus size={16} />} />
        {isHospital ? (
          <StatCard label="Beds occupied" value={admittedNow} delta={`of ${admissions.length} tracked`} tone="slate" icon={<BedDouble size={16} />} />
        ) : (
          <StatCard label={isSolo ? "Follow-ups due" : "Coordination items"} value={isSolo ? pendingFollowUps : coordination.length} delta={`${openTasks} open tasks`} tone="slate" icon={<BedDouble size={16} />} />
        )}
      </div>

      <div className="rp-grid-2 mt-5">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="rp-h2">Waiting queue</h2>
            <Badge tone="amber">{waiting} waiting</Badge>
          </div>
          <ul className="rp-list">
            {queue.slice(0, 5).map((q) => (
              <li key={q.token} className="rp-list-row">
                <Mono>{q.token}</Mono>
                <div className="flex-1 min-w-0">
                  <p className="rp-list-title">{q.patient}</p>
                  <p className="rp-list-sub">{q.doctor} · {q.department}</p>
                </div>
                <Badge tone={statusTone[q.status]}>{q.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="rp-h2">Today&apos;s appointments</h2>
            <Badge tone="pine">{todaysAppointments.length} scheduled</Badge>
          </div>
          <ul className="rp-list">
            {todaysAppointments.slice(0, 5).map((a) => (
              <li key={a.id} className="rp-list-row">
                <Mono>{a.time}</Mono>
                <div className="flex-1 min-w-0">
                  <p className="rp-list-title">{a.patient}</p>
                  <p className="rp-list-sub">{a.doctor} · {a.department}</p>
                </div>
                <Badge tone={a.status === "Confirmed" ? "pine" : a.status === "Pending" ? "amber" : a.status === "Cancelled" ? "coral" : "slate"}>
                  {a.status}
                </Badge>
              </li>
            ))}
            {todaysAppointments.length === 0 && (
              <p className="rp-sub">No appointments scheduled for today yet.</p>
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-5 rp-card-alert">
        <div className="flex items-center gap-2 mb-1">
          <Siren size={16} className="text-[var(--rp-coral)]" />
          <h2 className="rp-h2 !mb-0">{isHospital ? "Emergency arrivals" : "Clinical escalation boundary"}</h2>
        </div>
        <p className="rp-sub">
          {isHospital
            ? "Emergency registrations appear here immediately for clinical emergency team handoff."
            : "Reception routes emergency or clinical questions to the permitted clinical team and does not diagnose, interpret reports or change clinical orders."}
        </p>
      </Card>
    </div>
  );
}
