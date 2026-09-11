"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Mono, SectionHeader, Table } from "./ui";
import { useReceptionistData } from "./data-context";

const statusTone: Record<string, "pine" | "amber" | "coral" | "slate"> = {
  Open: "amber",
  "In progress": "pine",
  Completed: "slate",
  Cancelled: "slate",
};

export function Tasks() {
  const { context, tasks } = useReceptionistData();

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Tasks`}
        title="Reception tasks"
        description="Operational tasks assigned to reception for patient flow, missing documents, reminders and desk coordination."
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="rp-h2 !mb-0">Administrative task queue</h2>
          <Badge tone="amber">{tasks.filter((task) => task.status !== "Completed").length} open</Badge>
        </div>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks assigned" description="Doctor, clinic or hospital administrative tasks will appear here." />
        ) : (
          <Table columns={["Task", "Patient", "UHID", "Due", "Priority", "Status"]}>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <p className="font-medium text-[var(--rp-ink)]">{task.title}</p>
                  <p className="text-xs text-[var(--rp-slate)]">{task.description}</p>
                </td>
                <td>{task.patient}</td>
                <td><Mono>{task.uhid}</Mono></td>
                <td>{task.dueAt}</td>
                <td>{task.priority}</td>
                <td><Badge tone={statusTone[task.status] ?? "slate"}>{task.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
