"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import { WorkplaceBadge } from "@/components/doctor-workflow";
import { Card, EmptyState, Pill, SectionHeading, CardGridSkeleton, SectionSkeleton, Skeleton } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { ClinicQueueItem, QueueStatus } from "@/lib/doctor-workflow-types";

const tabs: Array<{ label: string; value: QueueStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Waiting", value: "waiting" },
  { label: "In Consultation", value: "in_consultation" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
  { label: "No-show", value: "no_show" },
];

export default function DoctorQueuePage() {
  const { clinicQueue, completeQueueConsultation, getWorkplace, isLoadingWorkflow, patients, startQueueConsultation, workplaces } = useDoctorWorkflow();
  // Scheduled appointments are represented as "upcoming" queue items. Start
  // on all statuses so booked patients are visible as soon as the queue opens.
  const [tab, setTab] = useState<QueueStatus | "all">("all");
  const [workplaceId, setWorkplaceId] = useState("all");

  const queueWorkplaces = workplaces;
  const visibleQueue = useMemo(
    () =>
      clinicQueue
        .filter((item) => tab === "all" || item.status === tab)
        .filter((item) => workplaceId === "all" || item.workplaceId === workplaceId),
    [clinicQueue, tab, workplaceId]
  );
  const activeQueue = visibleQueue.filter((item) => item.status !== "completed");
  const completedQueue = visibleQueue.filter((item) => item.status === "completed");
  const waitingCount = clinicQueue.filter((item) => item.status === "waiting").length;
  const inConsultation = clinicQueue.filter((item) => item.status === "in_consultation").length;
  const activeWorkplace = workplaceId === "all" ? undefined : getWorkplace(workplaceId);

  function renderQueueRows(items: ClinicQueueItem[]) {
    return items.map((item) => {
      const patient = patients.find((entry) => entry.id === item.patientId);
      const workplace = getWorkplace(item.workplaceId);
      return (
        <tr key={item.id}>
          <td>
            <span className="font-mono text-xs text-ink-muted">#{item.token}</span>
          </td>
          <td>
            <div className="min-w-[12rem]">
              <p className="font-semibold text-ink">{patient?.name ?? "Patient"}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{patient?.mrn ?? item.patientId}</p>
            </div>
          </td>
          <td>
            <p className="font-mono text-xs text-ink">{item.appointmentTime}</p>
            <p className="mt-0.5 text-xs text-clay-600">Waiting {item.waitingMins} min</p>
          </td>
          <td>
            <p className="min-w-[12rem] text-xs text-ink-soft">{item.reason}</p>
          </td>
          <td>
            <div className="min-w-[12rem]">
              <p className="text-xs font-semibold text-ink">{workplace?.name ?? "Workplace"}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{workplace?.location ?? workplace?.department ?? "Online"}</p>
            </div>
          </td>
          <td>
            <Pill tone={item.status === "in_consultation" ? "sage" : item.status === "waiting" ? "clay" : item.status === "completed" ? "sage" : "neutral"}>
              {item.status.replace("_", " ")}
            </Pill>
          </td>
          <td>
            <div className="flex min-w-[15rem] flex-wrap justify-end gap-2">
              <Link href={`/doctor/patients/${item.patientId}`} className="btn-secondary text-xs">
                Open Patient
              </Link>
              {item.status !== "completed" && (
                <Link
                  href={`/doctor/consultation?patient=${item.patientId}&appointment=${item.id}`}
                  onClick={() => startQueueConsultation(item.id)}
                  className="btn-primary text-xs"
                >
                  Start Consultation
                </Link>
              )}
              {item.status === "in_consultation" && (
                <button type="button" onClick={() => completeQueueConsultation(item.id)} className="btn-secondary text-xs">
                  Complete
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    });
  }

  function QueueTable({ items }: { items: ClinicQueueItem[] }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-clean">
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient</th>
              <th>Time</th>
              <th>Reason</th>
              <th>Workplace</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>{renderQueueRows(items)}</tbody>
        </table>
      </div>
    );
  }

  if (isLoadingWorkflow) {
    return (
      <div className="space-y-6">
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="!p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-8 w-12" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
        <CardGridSkeleton cards={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="04 - Clinic Queue"
        title="Clinic Queue"
        description="Run OPD patients by token, workplace and consultation status. Each queued case opens into the same encounter workspace."
        action={
          <select value={workplaceId} onChange={(event) => setWorkplaceId(event.target.value)} className="input-field h-10 w-64">
            <option value="all">All workplaces</option>
            {queueWorkplaces.map((workplace) => (
              <option key={workplace.id} value={workplace.id}>
                {workplace.name} {workplace.location ? `- ${workplace.location}` : ""}
              </option>
            ))}
          </select>
        }
      />

      {activeWorkplace && <WorkplaceBadge workplace={activeWorkplace} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="!p-4">
          <p className="eyebrow">Waiting now</p>
          <p className="mt-2 font-mono text-3xl text-ink">{waitingCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Checked-in patients</p>
        </Card>
        <Card className="!p-4">
          <p className="eyebrow">In consultation</p>
          <p className="mt-2 font-mono text-3xl text-ink">{inConsultation}</p>
          <p className="mt-1 text-xs text-ink-muted">Active encounter drafts</p>
        </Card>
        <Card className="!p-4 border-brand-100 bg-brand-50/70">
          <p className="eyebrow text-brand-700">Queue control</p>
          <p className="mt-2 text-sm font-semibold text-ink">Token based OPD flow</p>
          <p className="mt-1 text-xs text-ink-muted">Start consult, open patient file, or complete visit from one list.</p>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Today</p>
            <h2 className="font-display text-xl text-ink">Queue Board</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={clsx("rounded-md px-3 py-2 text-xs font-semibold", tab === item.value ? "bg-brand-500 text-white" : "bg-paper text-ink-soft")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {visibleQueue.length > 0 ? (
          <div className="space-y-5 p-5">
            {activeQueue.length > 0 && (
              <QueueTable items={activeQueue} />
            )}
            {completedQueue.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage-500">Completed</p>
                <QueueTable items={completedQueue} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No patients in this queue"
            description="Try another status or workplace filter."
            action={<Pill tone="neutral">Queue clear</Pill>}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
              <ClipboardList size={17} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Reception handoff</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">Queue items include token, appointment time, reason and current waiting time.</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sage-50 text-sage-500">
              <Clock size={17} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Consultation continuity</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">Starting a queue case marks it in consultation and opens the encounter route.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
