"use client";

import * as React from "react";
import { FlaskConical, Pill } from "lucide-react";
import { Badge, Card, EmptyState, Mono, SectionHeader, Table } from "./ui";
import { useReceptionistData } from "./data-context";

export function Coordination() {
  const { context, coordination } = useReceptionistData();

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Lab & Pharmacy`}
        title="Diagnostics and pharmacy coordination"
        description="Coordinate appointment, report-ready and fulfillment status while clinical interpretation remains with doctors."
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="rp-h2 !mb-0">Operational status</h2>
          <Badge tone="slate">{coordination.length} items</Badge>
        </div>
        {coordination.length === 0 ? (
          <EmptyState title="No coordination items" description="Lab, radiology, external report and pharmacy statuses will appear here." />
        ) : (
          <Table columns={["Type", "Patient", "UHID", "Owner", "Item", "Status", "Boundary"]}>
            {coordination.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    {item.type === "Pharmacy" ? <Pill size={14} /> : <FlaskConical size={14} />}
                    {item.type}
                  </span>
                </td>
                <td className="font-medium text-[var(--rp-ink)]">{item.patient}</td>
                <td><Mono>{item.uhid}</Mono></td>
                <td>{item.owner}</td>
                <td>{item.title}</td>
                <td><Badge tone="amber">{item.status}</Badge></td>
                <td className="text-xs text-[var(--rp-slate)]">{item.boundary}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
