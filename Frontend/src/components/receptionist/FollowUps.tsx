"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Mono, SectionHeader, Table } from "./ui";
import { useReceptionistData } from "./data-context";

const statusTone: Record<string, "pine" | "amber" | "coral" | "slate"> = {
  "Due Today": "amber",
  Upcoming: "pine",
  Overdue: "coral",
  Completed: "slate",
  Cancelled: "slate",
};

export function FollowUps() {
  const { context, followUps } = useReceptionistData();

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Follow-ups`}
        title="Follow-up coordination"
        description="Track clinician-defined follow-ups and keep patient communication moving without changing clinical plans."
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="rp-h2 !mb-0">Upcoming follow-ups</h2>
          <Badge tone="amber">{followUps.filter((item) => item.status === "Due Today" || item.status === "Overdue").length} due</Badge>
        </div>
        {followUps.length === 0 ? (
          <EmptyState title="No follow-ups found" description="Clinician-defined follow-up tasks will appear here when available." />
        ) : (
          <Table columns={["Patient", "UHID", "Doctor", "Due", "Reason", "Status"]}>
            {followUps.map((item) => (
              <tr key={item.id}>
                <td className="font-medium text-[var(--rp-ink)]">{item.patient}</td>
                <td><Mono>{item.uhid}</Mono></td>
                <td>{item.doctor}</td>
                <td>{item.dueAt}</td>
                <td>{item.reason}</td>
                <td><Badge tone={statusTone[item.status] ?? "slate"}>{item.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
