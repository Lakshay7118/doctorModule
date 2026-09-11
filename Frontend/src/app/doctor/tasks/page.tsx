"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock3, Siren } from "lucide-react";
import { WorkplaceBadge } from "@/components/doctor-workflow";
import { Card, EmptyState, Pill, SectionHeading, CardGridSkeleton, SectionSkeleton, Skeleton } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { DoctorTaskItem } from "@/lib/doctor-workflow-types";

const tabs = ["all", "urgent", "today", "upcoming", "completed"] as const;
type TaskTab = (typeof tabs)[number];

export default function DoctorTasksPage() {
  const { completeTask, doctorTasks, getWorkplace, isLoadingWorkflow, patients, startTask, workplaces } = useDoctorWorkflow();
  const [tab, setTab] = useState<TaskTab>("all");
  const [workplaceId, setWorkplaceId] = useState("all");

  const visibleTasks = useMemo(
    () =>
      doctorTasks
        .filter((task) => tab === "all" || task.status === tab)
        .filter((task) => workplaceId === "all" || task.workplaceId === workplaceId),
    [doctorTasks, tab, workplaceId]
  );
  const activeTasks = visibleTasks.filter((task) => task.status !== "completed");
  const completedTasks = visibleTasks.filter((task) => task.status === "completed");
  const urgentCount = doctorTasks.filter((task) => task.status === "urgent").length;
  const todayCount = doctorTasks.filter((task) => task.status === "today").length;
  const activeWorkplace = workplaceId === "all" ? undefined : getWorkplace(workplaceId);

  function renderTaskRows(items: DoctorTaskItem[]) {
    return items.map((task) => {
      const patient = task.patientId ? patients.find((entry) => entry.id === task.patientId) : undefined;
      const workplace = getWorkplace(task.workplaceId);
      return (
        <tr key={task.id}>
          <td>
            <div className="min-w-[14rem]">
              <p className="font-semibold text-ink">{task.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{patient?.name ?? workplace?.name ?? "Operational task"}</p>
            </div>
          </td>
          <td>
            <p className="min-w-[10rem] font-mono text-xs text-ink">{task.dueTime}</p>
          </td>
          <td>
            <div className="min-w-[12rem]">
              <p className="text-xs font-semibold text-ink">{workplace?.name ?? "Workplace"}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{workplace?.location ?? workplace?.department ?? "Online"}</p>
            </div>
          </td>
          <td>
            <div className="min-w-[11rem]">
              <p className="text-xs text-ink-soft">{task.source}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Assigned by {task.assignedBy}</p>
            </div>
          </td>
          <td>
            <Pill tone={task.priority === "Critical" || task.priority === "High" ? "alert" : "neutral"}>{task.priority}</Pill>
          </td>
          <td>
            <Pill tone={task.status === "completed" ? "sage" : task.status === "urgent" ? "alert" : task.status === "today" ? "clay" : "neutral"}>
              {task.status}
            </Pill>
          </td>
          <td>
            <div className="flex min-w-[15rem] flex-wrap justify-end gap-2">
              {task.status !== "completed" && (
                <>
                  <button type="button" onClick={() => startTask(task.id)} className="btn-secondary text-xs">
                    Start
                  </button>
                  <button type="button" onClick={() => completeTask(task.id)} className="btn-primary text-xs">
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
          </td>
        </tr>
      );
    });
  }

  function TaskTable({ items }: { items: DoctorTaskItem[] }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-clean">
          <thead>
            <tr>
              <th>Task</th>
              <th>Due</th>
              <th>Workplace</th>
              <th>Source</th>
              <th>Priority</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>{renderTaskRows(items)}</tbody>
        </table>
      </div>
    );
  }

  if (isLoadingWorkflow) {
    return (
      <div className="space-y-6">
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="!p-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="mt-3 h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-12" />
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
        eyebrow="14 - Tasks"
        title="Tasks"
        description="Track doctor work generated by lab reports, follow-ups, hospital duty, discharge review and online consultations."
        action={
          <select value={workplaceId} onChange={(event) => setWorkplaceId(event.target.value)} className="input-field h-10 w-64">
            <option value="all">All workplaces</option>
            {workplaces.map((workplace) => (
              <option key={workplace.id} value={workplace.id}>
                {workplace.name} {workplace.location ? `- ${workplace.location}` : ""}
              </option>
            ))}
          </select>
        }
      />

      {activeWorkplace && <WorkplaceBadge workplace={activeWorkplace} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card className="!p-4 border-alert-100 bg-alert-50">
          <Siren size={18} className="text-alert-500" />
          <p className="mt-3 text-sm font-semibold text-ink">Urgent</p>
          <p className="mt-1 font-mono text-2xl text-alert-500">{urgentCount}</p>
        </Card>
        <Card className="!p-4">
          <Clock3 size={18} className="text-clay-600" />
          <p className="mt-3 text-sm font-semibold text-ink">Today</p>
          <p className="mt-1 font-mono text-2xl text-ink">{todayCount}</p>
        </Card>
        <Card className="!p-4">
          <ClipboardCheck size={18} className="text-brand-700" />
          <p className="mt-3 text-sm font-semibold text-ink">Open work</p>
          <p className="mt-1 font-mono text-2xl text-ink">{doctorTasks.filter((task) => task.status !== "completed").length}</p>
        </Card>
        <Card className="!p-4">
          <CheckCircle2 size={18} className="text-sage-500" />
          <p className="mt-3 text-sm font-semibold text-ink">Completed</p>
          <p className="mt-1 font-mono text-2xl text-ink">{doctorTasks.filter((task) => task.status === "completed").length}</p>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Work board</p>
            <h2 className="font-display text-xl text-ink">My Doctor Tasks</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={clsx("rounded-md px-3 py-2 text-xs font-semibold capitalize", tab === item ? "bg-brand-500 text-white" : "bg-paper text-ink-soft")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {visibleTasks.length > 0 ? (
          <div className="space-y-5 p-5">
            {activeTasks.length > 0 && (
              <TaskTable items={activeTasks} />
            )}
            {completedTasks.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage-500">Completed</p>
                <TaskTable items={completedTasks} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="No tasks here" description="Try another status or workplace filter." action={<Pill tone="sage">Caught up</Pill>} />
        )}
      </Card>
    </div>
  );
}
