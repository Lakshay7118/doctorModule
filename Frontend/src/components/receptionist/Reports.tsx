"use client";

import * as React from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { Button, Card, Field, Input, Modal, Mono, SectionHeader, Select, StatCard, Table } from "./ui";
import { useReceptionistData } from "./data-context";
import { formatReceptionistDate, todayIso } from "./date-utils";

const reportTypes = [
  "Patient registrations",
  "Appointments",
  "Admissions",
  "Cancellations",
  "Overall reception activity",
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function reportRangeDates(range: string, customStart: string, customEnd: string) {
  const now = new Date();
  if (range === "This week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { startDate: isoDate(start), endDate: isoDate(now) };
  }
  if (range === "This month") {
    return { startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: isoDate(now) };
  }
  if (range === "Custom range") return { startDate: customStart, endDate: customEnd };
  const today = todayIso();
  return { startDate: today, endDate: today };
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function Reports() {
  const { patients, appointments, admissions, auditTrail, generateReport } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [type, setType] = React.useState(reportTypes[0]);
  const [range, setRange] = React.useState("Today");
  const [startDate, setStartDate] = React.useState(todayIso());
  const [endDate, setEndDate] = React.useState(todayIso());
  const [generated, setGenerated] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<Record<string, number> | null>(null);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    const rangeLabel =
      range === "Custom range"
        ? `${formatReceptionistDate(startDate)} to ${formatReceptionistDate(endDate)}`
        : range === "Today"
          ? formatReceptionistDate(todayIso())
          : range;
    const dates = reportRangeDates(range, startDate, endDate);
    const report = await generateReport({
      type: type as Parameters<typeof generateReport>[0]["type"],
      range: range as Parameters<typeof generateReport>[0]["range"],
      startDate: dates.startDate,
      endDate: dates.endDate,
    });
    setGenerated(`${type} - ${rangeLabel}`);
    setSummary(report ?? null);
    setModalOpen(false);
  }

  function handleDownloadCsv() {
    if (!generated || !summary) return;

    const rows = [
      ["Report", generated],
      ["Metric", "Value"],
      ...Object.entries(summary).map(([label, value]) => [label, value] as [string, number]),
    ];
    const csv = rows.map((row) => row.map((value) => csvCell(value)).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = generated.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${safeName || "reception-report"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Reports"
        title="Reports"
        description="Generate reports related to patient registrations, appointments, admissions, cancellations and overall reception activity."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <FileBarChart2 size={16} /> Generate Report
          </Button>
        }
      />

      <Modal open={modalOpen} title="Generate Report" eyebrow="Reception Reports" onClose={() => setModalOpen(false)} size="md">
        <form onSubmit={handleGenerate} className="space-y-4">
          <Field label="Report type" required>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {reportTypes.map((reportType) => <option key={reportType}>{reportType}</option>)}
            </Select>
          </Field>
          <Field label="Date range" required>
            <Select value={range} onChange={(event) => setRange(event.target.value)}>
              <option>Today</option>
              <option>This week</option>
              <option>This month</option>
              <option>Custom range</option>
            </Select>
          </Field>
          {range === "Custom range" && (
            <div className="rp-grid-2">
              <Field label="Start date" required>
                <Input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} required />
              </Field>
              <Field label="End date" required>
                <Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required />
              </Field>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <FileBarChart2 size={16} /> Generate report
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="rp-grid-4 mb-5">
        <StatCard label="Total patients" value={patients.length} tone="pine" />
        <StatCard label="Total appointments" value={appointments.length} tone="slate" />
        <StatCard label="Cancelled" value={appointments.filter((appointment) => appointment.status === "Cancelled").length} tone="amber" />
        <StatCard label="Admissions" value={admissions.length} tone="pine" />
      </div>

      <Card>
        <h2 className="rp-h2">Result</h2>
        {generated ? (
          <div>
            <p className="rp-sub mb-3">Report ready: <span className="font-medium text-ink">{generated}</span></p>
            {summary && (
              <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                {Object.entries(summary).map(([label, value]) => (
                  <div key={label} className="rounded-md border border-line bg-paper/60 px-3 py-2">
                    <p className="text-[10px] uppercase text-ink-muted">{label.replace(/([A-Z])/g, " $1").trim()}</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-ink">{value}</p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" onClick={handleDownloadCsv} disabled={!summary}>
              <Download size={16} /> Download CSV
            </Button>
          </div>
        ) : (
          <p className="rp-sub">Choose a report type and range, then generate to preview a summary here.</p>
        )}
      </Card>

      <Card className="mt-5">
        <h2 className="rp-h2">Reception audit trail</h2>
        <Table columns={["Action", "Detail", "Actor", "Time"]}>
          {auditTrail.map((entry) => (
            <tr key={entry.id}>
              <td className="font-medium text-[var(--rp-ink)]">{entry.action}</td>
              <td>{entry.detail}</td>
              <td>{entry.actor}</td>
              <td><Mono>{entry.time}</Mono></td>
            </tr>
          ))}
        </Table>
        {auditTrail.length === 0 && <p className="rp-sub mt-3">No receptionist actions have been logged yet.</p>}
      </Card>
    </div>
  );
}
