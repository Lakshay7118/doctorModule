"use client";

import Link from "next/link";
import { ArrowUpRight, Video, MapPin, Clock, CalendarCheck2, PlayCircle } from "lucide-react";
import { ActiveShiftBanner, ShiftCard } from "@/components/doctor-workflow";
import { Card, SectionHeading, StatusBadge, SeverityBadge, Avatar, Pill, SectionSkeleton, Skeleton } from "@/components/ui";
import { useMode } from "@/lib/mode-context";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { CURRENT_DATE_ISO, CURRENT_DATE_LABEL } from "@/lib/app-time";

const TODAY = CURRENT_DATE_ISO;

export default function DoctorDashboard() {
  const { workContext } = useMode();
  const { activeShift, alerts, appointments, clinicQueue, completeShift, currentDoctorName, doctorTasks, followUps, getWorkplace, hospitalWorklist, isLoadingWorkflow, patients, shifts, startShift } =
    useDoctorWorkflow();
  const todayShifts = shifts
    .filter((shift) => shift.date === TODAY)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextShift = todayShifts.find((shift) => shift.status === "upcoming");
  const todays = appointments
    .filter((a) => a.date === TODAY && a.workContext === workContext)
    .sort((a, b) => a.time.localeCompare(b.time));

  const dueFollowUps = followUps.filter(
    (f) => (f.status === "Due Today" || f.status === "Overdue")
  );
  const criticalAlerts = alerts.filter((a) => a.severity === "Critical" && !a.acknowledged);
  const visibleAlerts = alerts;
  const openTasks = doctorTasks.filter((task) => task.status !== "completed");
  const activePatients = patients;

  if (isLoadingWorkflow) {
    return (
      <div className="space-y-6">
        <SectionSkeleton action={false} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="border-brand-100 bg-brand-50/60">
            <Skeleton className="mb-3 h-3 w-28" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="mt-3 h-4 w-40" />
          </Card>
          <Card>
            <Skeleton className="mb-4 h-5 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          </Card>
        </div>
        <div className="vitals-strip">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="vitals-cell">
              <Skeleton className="h-3 w-28 bg-white/15" />
              <Skeleton className="mt-3 h-8 w-16 bg-white/20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={index} padded={false}>
                <div className="px-5 py-4">
                  <Skeleton className="h-6 w-48" />
                </div>
                <div className="divide-y divide-line">
                  {Array.from({ length: 4 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center gap-3 px-5 py-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="mt-2 h-3 w-56" />
                      </div>
                      <Skeleton className="h-7 w-20" />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <Skeleton className="mb-4 h-5 w-36" />
                <Skeleton className="mb-3 h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="01 - Dashboard"
        title={`Good morning, ${currentDoctorName}`}
        description={`${CURRENT_DATE_LABEL} - showing ${workContext} appointments, patients, follow-ups and open clinical work only.`}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="border-brand-100 bg-brand-50/60">
          {activeShift ? (
            <div className="space-y-4">
              <ActiveShiftBanner shift={activeShift} workplace={getWorkplace(activeShift.workplaceId)} />
              <div className="flex flex-wrap gap-2">
                <Link href={workContext === "hospital" ? "/doctor/hospital-duty" : "/doctor/queue"} className="btn-primary">
                  Continue Work
                </Link>
                <button type="button" onClick={() => completeShift(activeShift.id)} className="btn-secondary">
                  End Shift
                </button>
              </div>
            </div>
          ) : nextShift ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow text-brand-700">Next shift</p>
                <h2 className="mt-1 font-display text-xl text-ink">{getWorkplace(nextShift.workplaceId)?.name}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {nextShift.startTime} - {nextShift.endTime}
                </p>
              </div>
              <button type="button" onClick={() => startShift(nextShift.id)} className="btn-primary">
                <PlayCircle size={15} /> Start Shift
              </button>
            </div>
          ) : (
            <div>
              <p className="eyebrow text-brand-700">Shift status</p>
              <h2 className="mt-1 font-display text-xl text-ink">No active shift</h2>
              <Link href="/doctor/schedule" className="btn-secondary mt-4">
                Open Schedule
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2 className="font-display text-lg text-ink">Today</h2>
            </div>
            <Link href="/doctor/schedule" className="btn-ghost text-xs">
              Schedule <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {todayShifts.slice(0, 3).map((shift) => (
              <ShiftCard key={shift.id} shift={shift} workplace={getWorkplace(shift.workplaceId)} />
            ))}
          </div>
        </Card>
      </div>

      <div className="vitals-strip">
        <div className="vitals-cell">
          <span className="vitals-label">Appointments Today</span>
          <span className="vitals-value">
            {todays.length}
            <span className="vitals-unit">total</span>
          </span>
        </div>
        <div className="vitals-cell">
          <span className="vitals-label">Waiting Now</span>
          <span className="vitals-value">
            {workContext === "hospital" ? hospitalWorklist.filter((item) => item.status !== "completed").length : clinicQueue.filter((item) => item.status === "waiting").length}
            <span className="vitals-unit">patients</span>
          </span>
        </div>
        <div className="vitals-cell">
          <span className="vitals-label">Follow-ups Due</span>
          <span className="vitals-value">
            {dueFollowUps.length}
            <span className="vitals-unit">cases</span>
          </span>
        </div>
        <div className="vitals-cell">
          <span className="vitals-label">Critical Alerts</span>
          <span className="vitals-value text-alert-100">
            {criticalAlerts.length}
            <span className="vitals-unit">open</span>
          </span>
        </div>
        <div className="vitals-cell">
          <span className="vitals-label">Open Tasks</span>
          <span className="vitals-value">
            {doctorTasks.filter((task) => task.status !== "completed").length || openTasks.length}
            <span className="vitals-unit">pending</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-6">
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="eyebrow">Live schedule</p>
                <h2 className="font-display text-xl text-ink">Today&apos;s Queue</h2>
              </div>
              <Link href="/doctor/appointments" className="btn-ghost text-xs">
                View all <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-line">
              {todays.map((apt) => {
                const patient = patients.find((entry) => entry.id === apt.patientId);
                if (!patient) return null;
                return (
                  <div key={apt.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center">
                    <span className="font-mono text-xs text-ink-muted w-16 shrink-0 flex items-center gap-1">
                      <Clock size={12} /> {apt.time}
                    </span>
                    <Avatar initials={patient.avatarInitials} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink truncate">{patient.name}</p>
                      <p className="text-xs text-ink-muted truncate">{apt.reason}</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                      {apt.type === "Video" ? <Video size={12} /> : <MapPin size={12} />}
                      {apt.type}
                    </span>
                    <StatusBadge status={apt.status} />
                    <Link
                      href={`/doctor/consultation?patient=${patient.id}&appointment=${apt.id}`}
                      className="btn-secondary text-xs py-1.5"
                    >
                      Open
                    </Link>
                  </div>
                );
              })}
              {todays.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">No appointments scheduled for today.</p>
              )}
            </div>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="eyebrow">Continuity</p>
                <h2 className="font-display text-xl text-ink">Follow-ups Needing Attention</h2>
              </div>
              <Link href="/doctor/follow-up" className="btn-ghost text-xs">
                View all <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-line">
              {dueFollowUps.map((f) => {
                const patient = patients.find((entry) => entry.id === f.patientId);
                if (!patient) return null;
                return (
                  <div key={f.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center">
                    <Avatar initials={patient.avatarInitials} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink truncate">{patient.name}</p>
                      <p className="text-xs text-ink-muted truncate">{f.reason}</p>
                    </div>
                    <Pill tone={f.status === "Overdue" ? "alert" : "clay"}>{f.status}</Pill>
                    <Link href="/doctor/follow-up" className="btn-secondary text-xs py-1.5">
                      Schedule
                    </Link>
                  </div>
                );
              })}
              {dueFollowUps.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">Nothing due today. Nicely caught up.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-brand-100 bg-brand-50/70">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-white">
                <CalendarCheck2 size={17} />
              </span>
              <div>
                <p className="eyebrow text-brand-700">Recommended next build</p>
                <h2 className="mt-1 font-display text-lg text-ink">Duty and availability calendar</h2>
                <p className="mt-2 text-xs leading-5 text-ink-muted">
                  Connect hospital duty, clinic OPD, video slots, leave and conflict checks in one operational view.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-ink">Clinical Alerts</h2>
              <Link href="/doctor/alerts" className="btn-ghost text-xs">
                All <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {visibleAlerts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <SeverityBadge severity={a.severity} />
                  <div className="min-w-0">
                    <p className="text-xs text-ink-soft leading-snug">{a.message}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-ink">My Tasks</h2>
            </div>
            <div className="space-y-3">
              {openTasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-soft leading-snug">{t.title}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">Due {t.dueTime}</p>
                  </div>
                  <Pill tone={t.priority === "Critical" || t.priority === "High" ? "alert" : t.priority === "Medium" ? "clay" : "neutral"}>
                    {t.priority}
                  </Pill>
                </div>
              ))}
              {openTasks.length === 0 && <p className="text-xs text-ink-muted">No open tasks.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg text-ink mb-3">This Week</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-2xl text-ink">{activePatients.length}</p>
                <p className="text-[11px] text-ink-muted">Active patients</p>
              </div>
              <div>
                <p className="font-mono text-2xl text-ink">{appointments.filter((a) => a.status === "Completed").length}</p>
                <p className="text-[11px] text-ink-muted">Consultations done</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
