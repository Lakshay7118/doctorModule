"use client";

import { useMemo, useState } from "react";
import {
  TestTube, Truck, Inbox, XCircle, Hourglass, Microscope, Stethoscope, AlertTriangle,
  ShieldAlert, Server, Boxes, Send, IndianRupee, Wallet,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { EntityHeader } from "@/components/ui/EntityHeader";
import { MetricCard, WorkQueueCard, TrendCard, AlertCard } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { useDemo, useCurrentRole } from "@/state/demo-context";
import { MOCK_ORDERS } from "@/data/mock/orders";
import { MOCK_SPECIMENS, MOCK_MANIFESTS, MOCK_ANALYZERS } from "@/data/mock/specimens";
import { MOCK_QC_RUNS } from "@/data/mock/quality";
import { MOCK_STOCK_LOTS } from "@/data/mock/inventory";
import { MOCK_CRITICAL_NOTIFICATIONS } from "@/data/mock/results";
import { MOCK_SITES } from "@/data/mock/integrations";
import { formatCurrencyINR } from "@/lib/utils/format";
import { FailedPostingAlert } from "@/components/domain/ChargeSummary";
import { WorkflowOverview } from "@/components/domain/WorkflowOverview";
import { PriorityWork } from "@/components/domain/PriorityWork";
import { useHospitalWorkflow } from "@/state/hospital-workflow-context";

const TREND_DATA = [
  { day: "Mon", tat: 92 }, { day: "Tue", tat: 88 }, { day: "Wed", tat: 95 },
  { day: "Thu", tat: 90 }, { day: "Fri", tat: 84 }, { day: "Sat", tat: 96 }, { day: "Today", tat: 91 },
];

export default function DashboardPage() {
  const { billingEnabled, session } = useDemo();
  const role = useCurrentRole();
  const { activeSpecimens } = useHospitalWorkflow();
  const [priority, setPriority] = useState("all");
  const [site, setSite] = useState("all");

  const orders = useMemo(
    () => MOCK_ORDERS.filter((o) => {
      const expectedAuthority = session?.billingOwner === "HMS_CENTRAL" ? "HMS_CENTRAL" : session?.billingOwner === "LIS_INTERNAL" ? "LIS_INTERNAL" : session?.billingOwner === "B2B_CONTRACT" ? "EXTERNAL_CLIENT" : "NO_CHARGE";
      return o.billingAuthority === expectedAuthority && (session?.allowedSiteIds.includes(o.siteId) ?? false) && (priority === "all" || o.priority === priority) && (site === "all" || o.siteId === site);
    }),
    [priority, site, session]
  );

  const uncollected = orders.filter((o) => o.status === "placed").length;
  const inTransit = MOCK_MANIFESTS.filter((m) => m.status === "in_transit").length;
  const specimenRegistry = [...activeSpecimens, ...MOCK_SPECIMENS.filter((candidate) => !activeSpecimens.some((current) => current.id === candidate.id))];
  const pendingAccession = specimenRegistry.filter((s) => s.status === "received").length;
  const rejected = specimenRegistry.filter((s) => s.status === "rejected").length;
  const pendingProcessing = orders.filter((o) => o.status === "collected" || o.status === "in_progress").length;
  const pendingTechReview = orders.filter((o) => o.status === "in_progress").length;
  const pendingMedValidation = 2;
  const tatBreaches = 3;
  const criticalAwaiting = MOCK_CRITICAL_NOTIFICATIONS.filter((c) => !c.acknowledged).length;
  const qcBlocks = MOCK_QC_RUNS.filter((q) => q.status === "out_of_control").length;
  const analyzerDowntime = MOCK_ANALYZERS.filter((a) => a.status !== "connected").length;
  const lowStock = MOCK_STOCK_LOTS.filter((l) => l.status === "near_expiry" || l.status === "expired" || l.status === "quarantined").length;
  const sendOutDelays = MOCK_MANIFESTS.filter((m) => m.status === "delayed").length;
  const roleFocus = role.id === "phlebotomist"
    ? [["Awaiting collection", "18", "/queues/uncollected"], ["Recollection requests", "4", "/queues/rejected"], ["STAT collections", "6", "/queues/uncollected"], ["Ward / home tasks", "9", "/collection"]]
    : role.id === "technologist" || role.id === "section_supervisor"
      ? [["Ready for processing", "34", "/queues/pending-processing"], ["Analyzer / manual work", "17", "/workbench"], ["QC blocks", String(qcBlocks), "/quality/qc"], ["Technical review", "15", "/queues/tech-review"]]
      : role.id === "lab_director"
        ? [["Medical validation", "11", "/queues/medical-validation"], ["Critical results", String(criticalAwaiting), "/critical-results"], ["TAT breaches", String(tatBreaches), "/queues/tat-breach"], ["Preliminary reports", "8", "/reports"]]
        : [["My pending orders", String(orders.length), "/orders"], ["Awaiting receipt", "12", "/queues/pending-receipt"], ["Exceptions", "5", "/queues"], ["Completed today", "126", "/queues/completed"]];

  return (
    <div className="space-y-6">
      <EntityHeader
        eyebrow="Module 1 · Laboratory Operations"
        title="Command Center"
        subtitle={`Welcome back — showing the ${role.label} view across ${site === "all" ? "all sites" : MOCK_SITES.find((s) => s.id === site)?.name}.`}
      />

      <FilterBar
        filters={[
          {
            id: "priority", label: "Priority", value: priority, onChange: setPriority,
            options: [{ value: "all", label: "All" }, { value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }, { value: "stat", label: "STAT" }],
          },
          {
            id: "site", label: "Site", value: site, onChange: setSite,
            options: [{ value: "all", label: "All permitted sites" }, ...MOCK_SITES.filter((s) => session?.allowedSiteIds.includes(s.id)).map((s) => ({ value: s.id, label: s.name }))],
          },
        ]}
      />

      {session?.billingOwner === "HMS_CENTRAL" && <FailedPostingAlert count={orders.filter((o) => o.hmsPostingStatus === "reconciliation_required").length} />}

      <WorkflowOverview />

      <section aria-label={`${role.label} focus`}>
        <div className="mb-3"><h2 className="font-display text-lg font-semibold">{role.label} Focus</h2><p className="text-xs text-text-muted">Queues prioritized for your current role and permitted scope.</p></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{roleFocus.map(([label, value, href]) => <a key={label} href={href} className="rounded-card border border-app-border bg-app-surface p-4 transition hover:border-brand-blue"><p className="text-xs text-text-muted">{label}</p><p className="mt-2 font-display text-2xl font-semibold">{value}</p></a>)}</div>
      </section>

      {/* Pre-analytical row */}
      <section aria-label="Pre-analytical metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Uncollected samples" value={uncollected} icon={TestTube} tone={0} href="/queues/uncollected" sublabel="Awaiting phlebotomy / pickup" />
        <MetricCard label="In-transit samples" value={inTransit} icon={Truck} tone={1} href="/logistics" sublabel="On active courier routes" />
        <MetricCard label="Pending accession" value={pendingAccession} icon={Inbox} tone={2} href="/accessioning" sublabel="Received, not yet accessioned" />
        <MetricCard label="Rejected samples" value={rejected} icon={XCircle} tone={3} href="/specimens/rejections" sublabel="Needs recollection" trend={{ direction: "down", value: "2 vs yesterday" }} />
      </section>

      {/* Analytical row */}
      <section aria-label="Analytical metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pending processing" value={pendingProcessing} icon={Hourglass} tone={0} href="/workbench" />
        <MetricCard label="Pending technical review" value={pendingTechReview} icon={Microscope} tone={1} href="/validation" />
        <MetricCard label="Pending medical validation" value={pendingMedValidation} icon={Stethoscope} tone={2} href="/validation" />
        <MetricCard label="TAT breaches (24h)" value={tatBreaches} icon={AlertTriangle} tone={3} href="/queues/tat-breach" trend={{ direction: "up", value: "1 vs yesterday" }} />
      </section>

      {/* Post-analytical / operational row */}
      <section aria-label="Operational risk metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Critical results awaiting ack." value={criticalAwaiting} icon={ShieldAlert} tone={3} href="/critical-results" />
        <MetricCard label="QC blocks" value={qcBlocks} icon={ShieldAlert} tone={3} href="/quality/qc" />
        <MetricCard label="Analyzer downtime" value={analyzerDowntime} icon={Server} tone={1} href="/analyzers" />
        <MetricCard label="Low-stock / expiring lots" value={lowStock} icon={Boxes} tone={2} href="/inventory/lots" />
      </section>

      {billingEnabled && (
        <section aria-label="Revenue metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Today's revenue" value={formatCurrencyINR(184500)} icon={IndianRupee} tone={0} href="/billing/invoices" trend={{ direction: "up", value: "6.2%" }} />
          <MetricCard label="Outstanding receivables" value={formatCurrencyINR(1245300)} icon={Wallet} tone={1} href="/billing/receivables" />
          <MetricCard label="Send-out delays" value={sendOutDelays} icon={Send} tone={2} href="/send-outs" />
          <MetricCard label="Pending estimates" value={4} icon={Hourglass} tone={3} href="/billing/estimates" />
        </section>
      )}

      {!billingEnabled && (
        <section aria-label="Send-out metric" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Send-out delays" value={sendOutDelays} icon={Send} tone={2} href="/send-outs" />
        </section>
      )}

      <PriorityWork />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendCard title="TAT compliance — last 7 days" action={<span className="text-xs text-text-muted">% within target</span>}>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="tatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--qlyno-brand-500))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(var(--qlyno-brand-500))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "rgb(var(--qlyno-ink-muted))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgb(var(--qlyno-line))", fontSize: 12 }} />
                <Area type="monotone" dataKey="tat" stroke="rgb(var(--qlyno-brand-500))" strokeWidth={2} fill="url(#tatFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TrendCard>

        <div className="space-y-3 lg:col-span-2">
          <AlertCard title="Analyzer offline" tone="critical" count={analyzerDowntime} description="iChem Urine Analyzer — offline since 04:22" href="/analyzers" />
          <AlertCard title="QC out of control" tone="critical" count={qcBlocks} description="Glucose L2 — 1-3s Westgard violation" href="/quality/qc" />
          <AlertCard title="Reagents near expiry" tone="warning" count={lowStock} description="Glucose Kit, TSH Cartridge expiring within 5 days" href="/inventory/lots" />
          <AlertCard title="HMS posting requires reconciliation" tone="warning" count={1} description="ORD-70016 — Fatima Sheikh" href="/integrations/hms-billing" />
        </div>
      </div>

      <section aria-label="Role work queues" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <WorkQueueCard
          title="My work queue"
          href="/queues"
          items={orders.slice(0, 6).map((o) => ({
            id: o.id,
            primary: `${o.id} · ${o.patientName}`,
            secondary: o.departmentIds.join(", "),
            badge: <PriorityBadge priority={o.priority} />,
          }))}
        />
        <WorkQueueCard
          title="Specimens pending accession"
          href="/accessioning"
          items={specimenRegistry.filter((s) => s.status === "received").map((s) => ({
            id: s.id,
            primary: `${s.id} · ${s.patientName}`,
            secondary: s.type,
            badge: <StatusBadge status={s.status} />,
          }))}
        />
        <WorkQueueCard
          title="Critical results"
          href="/critical-results"
          items={MOCK_CRITICAL_NOTIFICATIONS.map((c) => ({
            id: c.id,
            primary: `${c.testName} · ${c.patientName}`,
            secondary: `Notify: ${c.notifiedTo}`,
            badge: <StatusBadge status={c.acknowledged ? "verified" : "blocked"} />,
          }))}
        />
      </section>
    </div>
  );
}
