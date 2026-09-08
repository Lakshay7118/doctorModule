"use client";

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { EntityHeader } from "@/components/ui/EntityHeader";
import { TrendCard } from "@/components/ui/Card";
import { useDemo } from "@/state/demo-context";

const OPERATIONAL = [
  { label: "Mon", value: 210 }, { label: "Tue", value: 198 }, { label: "Wed", value: 245 },
  { label: "Thu", value: 231 }, { label: "Fri", value: 264 }, { label: "Sat", value: 176 }, { label: "Today", value: 152 },
];
const QUALITY = [
  { label: "Chem", value: 98 }, { label: "Hem", value: 99 }, { label: "Coag", value: 94 },
  { label: "Immuno", value: 97 }, { label: "Micro", value: 96 },
];
const COMMERCIAL = [
  { label: "Mon", value: 142000 }, { label: "Tue", value: 168000 }, { label: "Wed", value: 155000 },
  { label: "Thu", value: 174000 }, { label: "Fri", value: 191000 }, { label: "Sat", value: 121000 }, { label: "Today", value: 184500 },
];

function MiniBar({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--qlyno-line))" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--qlyno-ink-muted))" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgb(var(--qlyno-line))", fontSize: 12 }} />
          <Bar dataKey="value" fill="rgb(var(--qlyno-brand-500))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsPage() {
  const { billingEnabled } = useDemo();

  return (
    <div className="space-y-6">
      <EntityHeader eyebrow="Module 12 · Analytics & Administration" title="Analytics" subtitle="Operational, pre/post-analytical, quality and logistics analytics." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendCard title="Operational — Orders per day">
          <MiniBar data={OPERATIONAL} />
        </TrendCard>
        <TrendCard title="Quality — TAT compliance % by department">
          <MiniBar data={QUALITY} />
        </TrendCard>
        {billingEnabled && (
          <TrendCard title="Commercial — Daily revenue (₹)">
            <MiniBar data={COMMERCIAL} />
          </TrendCard>
        )}
        <TrendCard title="Logistics / Network — Manifest on-time %">
          <MiniBar data={[{ label: "Wk1", value: 92 }, { label: "Wk2", value: 89 }, { label: "Wk3", value: 95 }, { label: "Wk4", value: 90 }]} />
        </TrendCard>
      </div>
    </div>
  );
}
