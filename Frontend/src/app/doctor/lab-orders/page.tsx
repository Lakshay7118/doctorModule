"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, FileText, FlaskConical, Plus, Printer } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, Modal, SectionSkeleton, Skeleton } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { LabOrder, OrderStatus, Patient } from "@/lib/types";
import { CURRENT_DATE_ISO } from "@/lib/app-time";
import { createBackendOrder, getBackendBootstrap, updateBackendOrderStatus } from "@/lib/api-client";

const commonTests = ["HbA1c", "Complete Blood Count", "Lipid Profile", "Thyroid Panel", "Troponin-I", "Liver Function Test", "Kidney Function Test", "Urinalysis"];

const columns: OrderStatus[] = ["Ordered", "Sample Collected", "In Progress", "Report Ready", "Reviewed"];

function reportRows(order: LabOrder) {
  if (!order.report) return [["Result", "Report not available", "-"]];
  return [
    ["Summary", order.report.resultSummary ?? "No summary recorded", "-"],
    ["Interpretation", order.report.interpretation ?? "No interpretation recorded", "-"],
  ];
}

function LabOrdersBoard() {
  const params = useSearchParams();
  const preselected = params.get("patient");
  const { selectedWorkplaceId, workContext } = useMode();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState("");
  const [patientId, setPatientId] = useState(preselected ?? "");
  const [showForm, setShowForm] = useState(false);
  const [testName, setTestName] = useState("");
  const [priority, setPriority] = useState<"Routine" | "Urgent">("Routine");
  const [source, setSource] = useState<"Internal" | "Partner Lab" | "External / Manual">("Internal");
  const [selectedReport, setSelectedReport] = useState<LabOrder | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const contextOrders = orders.filter((order) => matchesWorkContext(order, workContext));
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        setPatients(data.patients);
        setOrders(data.labOrders);
        setBackendDoctorId(data.currentDoctorId ?? data.doctors[0]?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
        setOrders([]);
        setBackendDoctorId("");
        setSyncMessage("Unable to load laboratory orders from the backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPatientId((current) =>
      contextPatients.some((patient) => patient.id === current) ? current : contextPatients[0]?.id ?? current
    );
  }, [contextPatients]);

  if (isLoadingOrders) {
    return (
      <div>
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {columns.map((column) => (
            <div key={column}>
              <div className="mb-2 flex items-center gap-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="!p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="mb-3 h-4 w-full" />
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function placeOrder() {
    if (!testName.trim()) return;
    const localOrder: LabOrder = {
      id: `lab-${Date.now()}`,
      patientId,
      doctorId: backendDoctorId,
      testName,
      orderedOn: CURRENT_DATE_ISO,
      status: "Ordered",
      source,
      priority,
      workContext,
    };
    try {
      const savedOrder = await createBackendOrder({
        patientId,
        doctorId: backendDoctorId,
        workplaceId: selectedWorkplaceId,
        type: "LABORATORY",
        title: testName,
        priority,
        source,
      });
      localOrder.id = savedOrder.id;
      setSyncMessage("Lab order synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "lab order was not saved."}`);
      return;
    }
    setOrders((prev) => [localOrder, ...prev]);
    setTestName("");
    setShowForm(false);
  }

  async function advance(id: string) {
    let nextStatus: OrderStatus = "Ordered";
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    const idx = columns.indexOf(order.status);
    const next = columns[Math.min(idx + 1, columns.length - 1)];
    nextStatus = next;
    try {
      await updateBackendOrderStatus(id, nextStatus);
      setOrders((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
      setSyncMessage("Lab order status synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "lab order status was not updated."}`);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow="09 - Laboratory Orders"
        title="Laboratory Orders"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> New Lab Order
          </button>
        }
        description={`Request ${workContext} pathology investigations, monitor pending tests, and review completed lab reports.`}
      />

      <Modal
        open={showForm}
        title="New Lab Order"
        eyebrow="Laboratory Orders"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={placeOrder} className="btn-primary">
              <Plus size={14} /> Place Order
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Patient</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-field">
              {contextPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Test</label>
            <input
              list="common-tests"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. HbA1c"
              className="input-field"
            />
            <datalist id="common-tests">
              {commonTests.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="input-field">
              <option>Routine</option>
              <option>Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value as any)} className="input-field">
            <option>Internal</option>
            <option>Partner Lab</option>
            <option>External / Manual</option>
          </select>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(selectedReport)}
        title="Lab Report"
        eyebrow="Reviewed Report"
        onClose={() => setSelectedReport(null)}
        size="lg"
        footer={
          <>
            <button className="btn-secondary">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => setSelectedReport(null)} className="btn-secondary">
              Close
            </button>
          </>
        }
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-paper p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <FileText size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-ink">{selectedReport.testName}</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {patientById.get(selectedReport.patientId)?.name ?? "Patient"} -{" "}
                    {selectedReport.source}
                  </p>
                </div>
                <Pill tone={selectedReport.priority === "Urgent" ? "alert" : "neutral"}>{selectedReport.priority}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-ink-muted sm:grid-cols-3">
                <p>
                  <span className="block font-semibold uppercase tracking-[0.06em] text-ink-faint">Order ID</span>
                  {selectedReport.id}
                </p>
                <p>
                  <span className="block font-semibold uppercase tracking-[0.06em] text-ink-faint">Ordered On</span>
                  {selectedReport.orderedOn}
                </p>
                <p>
                  <span className="block font-semibold uppercase tracking-[0.06em] text-ink-faint">Status</span>
                  {selectedReport.status}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-card border border-line">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-paper text-left text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="border-b border-line px-4 py-2.5 font-semibold">Parameter</th>
                    <th className="border-b border-line px-4 py-2.5 font-semibold">Result</th>
                    <th className="border-b border-line px-4 py-2.5 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows(selectedReport).map(([parameter, result, reference]) => (
                    <tr key={parameter}>
                      <td className="border-b border-line/70 px-4 py-3 text-ink-soft">{parameter}</td>
                      <td className="border-b border-line/70 px-4 py-3 font-mono text-ink">{result}</td>
                      <td className="border-b border-line/70 px-4 py-3 text-ink-muted">{reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="rounded-md border border-sage-100 bg-sage-50 px-3 py-2 text-xs leading-5 text-sage-500">
              Reviewed by Dr. Ananya Rao. Correlate with symptoms, vitals and prior records before clinical decisions.
            </p>
          </div>
        )}
      </Modal>
      {syncMessage && <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {columns.map((col) => (
          <div key={col}>
            <p className="text-xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
              <FlaskConical size={12} /> {col} ({contextOrders.filter((o) => o.status === col).length})
            </p>
            <div className="space-y-2.5">
              {contextOrders
                .filter((o) => o.status === col)
                .map((o) => {
                  const patient = patientById.get(o.patientId);
                  return (
                    <Card key={o.id} className="!p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {patient && <Avatar initials={patient.avatarInitials} size={22} />}
                        <p className="text-xs font-medium text-ink truncate">{patient?.name}</p>
                      </div>
                      <p className="text-sm text-ink-soft mb-1">{o.testName}</p>
                      <div className="flex items-center justify-between">
                        <Pill tone={o.priority === "Urgent" ? "alert" : "neutral"}>{o.priority}</Pill>
                        {col === "Reviewed" ? (
                          <button
                            onClick={() => setSelectedReport(o)}
                            className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline"
                          >
                            <Eye size={12} /> View report
                          </button>
                        ) : (
                          <button onClick={() => advance(o.id)} className="text-[11px] text-brand-600 hover:underline">
                            Advance →
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              {contextOrders.filter((o) => o.status === col).length === 0 && (
                <p className="text-xs text-ink-faint">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LabOrdersPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <LabOrdersBoard />
    </Suspense>
  );
}
