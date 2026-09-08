"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EntityHeader } from "@/components/ui/EntityHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { QCBlockBanner } from "@/components/domain/CriticalAlertBanner";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MOCK_QC_RUNS } from "@/data/mock/quality";

const LJ_POINTS = [
  { run: 1, value: 100.2 }, { run: 2, value: 99.4 }, { run: 3, value: 101.5 }, { run: 4, value: 98.9 },
  { run: 5, value: 100.8 }, { run: 6, value: 97.1 }, { run: 7, value: 106.4 }, { run: 8, value: 100.1 },
];
const MEAN = 100;
const SD = 3;

export default function QcDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const run = MOCK_QC_RUNS.find((q) => q.id === id);
  if (!run) notFound();

  const { showToast } = useToast();
  const [lot, setLot] = useState(run.controlLot);

  return (
    <div className="space-y-6">
      <EntityHeader eyebrow="Module 8 · Quality Management" title={`${run.analyte} QC — ${run.level}`} subtitle={run.department} badges={<StatusBadge status={run.status} />} />

      {run.status === "out_of_control" && <QCBlockBanner analyte={run.analyte} department={run.department} reason={run.westgardViolation ?? "Westgard rule violation"} />}

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-main">Levey–Jennings chart</h3>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Control lot
            <select value={lot} onChange={(e) => setLot(e.target.value)} className="h-8 rounded-control border border-app-border bg-white px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
              <option value={run.controlLot}>{run.controlLot}</option>
              <option value="LOT-ALT-001">LOT-ALT-001 (alternate)</option>
            </select>
          </label>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={LJ_POINTS} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <XAxis dataKey="run" tick={{ fontSize: 11, fill: "rgb(var(--qlyno-ink-muted))" }} axisLine={false} tickLine={false} label={{ value: "Run #", position: "insideBottom", offset: -2, fontSize: 11, fill: "rgb(var(--qlyno-ink-muted))" }} />
              <YAxis domain={[MEAN - 4 * SD, MEAN + 4 * SD]} tick={{ fontSize: 11, fill: "rgb(var(--qlyno-ink-muted))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgb(var(--qlyno-line))", fontSize: 12 }} />
              <ReferenceLine y={MEAN} stroke="rgb(var(--qlyno-success-500))" strokeDasharray="4 2" label={{ value: "Mean", fontSize: 10, fill: "rgb(var(--qlyno-success-500))" }} />
              <ReferenceLine y={MEAN + 2 * SD} stroke="rgb(var(--qlyno-warning-500))" strokeDasharray="3 3" label={{ value: "+2SD", fontSize: 10, fill: "rgb(var(--qlyno-warning-500))" }} />
              <ReferenceLine y={MEAN - 2 * SD} stroke="rgb(var(--qlyno-warning-500))" strokeDasharray="3 3" label={{ value: "-2SD", fontSize: 10, fill: "rgb(var(--qlyno-warning-500))" }} />
              <ReferenceLine y={MEAN + 3 * SD} stroke="rgb(var(--qlyno-alert-500))" strokeDasharray="2 2" label={{ value: "+3SD", fontSize: 10, fill: "rgb(var(--qlyno-alert-500))" }} />
              <ReferenceLine y={MEAN - 3 * SD} stroke="rgb(var(--qlyno-alert-500))" strokeDasharray="2 2" label={{ value: "-3SD", fontSize: 10, fill: "rgb(var(--qlyno-alert-500))" }} />
              <Line type="monotone" dataKey="value" stroke="rgb(var(--qlyno-brand-500))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-text-muted">Illustrative Levey–Jennings plot with ±2SD / ±3SD reference bands (mock data, not tied to a real lot).</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => showToast({ title: "QC run reviewed (simulated)", tone: "success" })}>Mark reviewed</Button>
        <Button size="sm" variant="outline" onClick={() => showToast({ title: "QC run closed (simulated)", tone: "info" })}>Close run</Button>
      </div>
    </div>
  );
}
