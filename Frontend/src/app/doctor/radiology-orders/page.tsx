"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ScanLine } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, OrderStatusBadge, Modal, SectionSkeleton, TableSkeleton } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { ImagingType, Patient, RadiologyOrder } from "@/lib/types";
import { CURRENT_DATE_ISO } from "@/lib/app-time";
import { createBackendOrder, getBackendBootstrap } from "@/lib/api-client";

const imagingTypes: ImagingType[] = ["X-Ray", "CT Scan", "MRI", "Ultrasound"];

function RadiologyOrdersList() {
  const params = useSearchParams();
  const preselected = params.get("patient");
  const { selectedWorkplaceId, workContext } = useMode();
  const [orders, setOrders] = useState<RadiologyOrder[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState("");
  const [patientId, setPatientId] = useState(preselected ?? "");
  const [showForm, setShowForm] = useState(false);
  const [imagingType, setImagingType] = useState<ImagingType>("X-Ray");
  const [bodyRegion, setBodyRegion] = useState("");
  const [priority, setPriority] = useState<"Routine" | "Urgent">("Routine");
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
        setOrders(data.radiologyOrders);
        setBackendDoctorId(data.currentDoctorId ?? data.doctors[0]?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
        setOrders([]);
        setBackendDoctorId("");
        setSyncMessage("Unable to load radiology orders from the backend.");
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
        <TableSkeleton columns={5} rows={7} />
      </div>
    );
  }

  async function placeOrder() {
    if (!bodyRegion.trim()) return;
    const localOrder: RadiologyOrder = {
      id: `rad-${Date.now()}`,
      patientId,
      doctorId: backendDoctorId,
      imagingType,
      bodyRegion,
      orderedOn: CURRENT_DATE_ISO,
      status: "Ordered",
      priority,
      workContext,
    };
    try {
      const savedOrder = await createBackendOrder({
        patientId,
        doctorId: backendDoctorId,
        workplaceId: selectedWorkplaceId,
        type: "RADIOLOGY",
        title: `${imagingType} - ${bodyRegion}`,
        priority,
      });
      localOrder.id = savedOrder.id;
      setSyncMessage("Radiology order synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "radiology order was not saved."}`);
      return;
    }
    setOrders((prev) => [localOrder, ...prev]);
    setBodyRegion("");
    setShowForm(false);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="10 - Radiology Orders"
        title="Radiology Orders"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> New Imaging Order
          </button>
        }
        description={`Order ${workContext} imaging investigations including X-Ray, CT Scan, MRI and Ultrasound while reviewing radiology reports.`}
      />

      <Modal
        open={showForm}
        title="New Imaging Order"
        eyebrow="Radiology Orders"
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
            <label className="text-[11px] text-ink-muted block mb-1">Type</label>
            <select value={imagingType} onChange={(e) => setImagingType(e.target.value as ImagingType)} className="input-field">
              {imagingTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Body Region</label>
            <input
              value={bodyRegion}
              onChange={(e) => setBodyRegion(e.target.value)}
              placeholder="e.g. Chest"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="input-field">
              <option>Routine</option>
              <option>Urgent</option>
            </select>
          </div>
        </div>
      </Modal>
      {syncMessage && <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>}

      <Card padded={false}>
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <ScanLine size={16} className="text-brand-600" />
          <h2 className="font-display text-lg text-ink">All {workContext} Radiology Orders</h2>
        </div>
        <table className="w-full table-clean">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Study</th>
              <th>Ordered</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contextOrders.map((o) => {
              const patient = patientById.get(o.patientId);
              return (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {patient && <Avatar initials={patient.avatarInitials} size={26} />}
                      {patient?.name}
                    </div>
                  </td>
                  <td>
                    {o.imagingType} — {o.bodyRegion}
                  </td>
                  <td className="font-mono text-xs">{o.orderedOn}</td>
                  <td>
                    <Pill tone={o.priority === "Urgent" ? "alert" : "neutral"}>{o.priority}</Pill>
                  </td>
                  <td>
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function RadiologyOrdersPage() {
  return (
    <Suspense fallback={<><SectionSkeleton /><TableSkeleton columns={5} rows={7} /></>}>
      <RadiologyOrdersList />
    </Suspense>
  );
}
