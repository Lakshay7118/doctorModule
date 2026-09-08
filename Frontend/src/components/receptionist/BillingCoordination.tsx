"use client";

import * as React from "react";
import { ArrowRightLeft, Bed, IndianRupee, Receipt } from "lucide-react";
import { Badge, Card, Mono, SectionHeader, StatCard, Table } from "./ui";
import { useReceptionistData } from "./data-context";
import type { BillingRow } from "./data-context";

interface TransferRequest {
  id: string;
  patient: string;
  from: string;
  to: string;
  reason: string;
  status: "Awaiting billing" | "Ready to transfer";
}

export function BillingCoordination() {
  const { admissions, billingRows } = useReceptionistData();

  const rows: BillingRow[] = billingRows;
  const transfers: TransferRequest[] = admissions
    .filter((admission) => admission.status === "Admitted")
    .map((admission) => {
      const pending = rows.some((row) => row.patientId === admission.patientId && row.status === "Pending");
      return {
        id: admission.id,
        patient: admission.patient,
        from: `${admission.ward} / ${admission.bed}`,
        to: "Transfer request not raised",
        reason: pending ? "Outstanding billing must be cleared before transfer." : "No pending invoice found for this admission.",
        status: pending ? "Awaiting billing" : "Ready to transfer",
      };
    });

  const totalCollected = rows.filter((r) => r.status !== "Pending").reduce((sum, row) => sum + row.amount, 0);
  const totalPending = rows.filter((r) => r.status === "Pending").reduce((sum, row) => sum + row.amount, 0);
  const tone: Record<BillingRow["status"], "pine" | "amber" | "slate"> = {
    Paid: "pine",
    "Advance received": "slate",
    Pending: "amber",
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Billing"
        title="Billing coordination"
        description="Coordinate registration fees, consultation charges, advance payments, billing status, and ward or bed transfer payment checks."
      />

      <div className="rp-grid-4 mb-5">
        <StatCard label="Collected today" value={`Rs ${totalCollected.toLocaleString("en-IN")}`} tone="pine" icon={<IndianRupee size={16} />} />
        <StatCard label="Pending charges" value={`Rs ${totalPending.toLocaleString("en-IN")}`} tone="amber" icon={<Receipt size={16} />} />
        <StatCard label="Transactions today" value={rows.length} tone="slate" />
        <StatCard label="Advance payments" value={rows.filter((r) => r.status === "Advance received").length} tone="pine" />
      </div>

      <Card>
        <h2 className="rp-h2">Recent billing activity</h2>
        <Table columns={["Bill ID", "Patient", "UHID", "Charge", "Amount", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Mono>{row.id}</Mono></td>
              <td className="font-medium text-[var(--rp-ink)]">{row.patient}</td>
              <td><Mono>{row.uhid}</Mono></td>
              <td>{row.item}</td>
              <td><Mono>Rs {row.amount.toLocaleString("en-IN")}</Mono></td>
              <td><Badge tone={tone[row.status]}>{row.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card className="mt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Ward and bed</p>
            <h2 className="rp-h2 !mb-0">Transfer justification</h2>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <ArrowRightLeft size={16} />
          </span>
        </div>
        <div className="space-y-3">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="rounded-md border border-line bg-paper/60 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_1fr_1fr_160px] lg:items-start">
                <div>
                  <p className="eyebrow">Request</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-ink">{transfer.id}</p>
                </div>
                <div>
                  <p className="eyebrow">Patient</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{transfer.patient}</p>
                </div>
                <div>
                  <p className="eyebrow">Ward / Bed</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <Bed size={14} className="text-brand-700" />
                    <span>{transfer.from}</span>
                    <span className="text-ink-faint">to</span>
                    <span>{transfer.to}</span>
                  </div>
                </div>
                <div className="lg:text-right">
                  <Badge tone={transfer.status === "Ready to transfer" ? "pine" : "amber"}>{transfer.status}</Badge>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-line bg-white px-3 py-2">
                <p className="eyebrow">Justification reason</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{transfer.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
