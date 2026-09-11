"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Plus } from "lucide-react";
import { SectionHeading, Card, Avatar, Modal, SectionSkeleton, Skeleton } from "@/components/ui";
import { patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { Patient, Vitals } from "@/lib/types";
import { createBackendVitals, getBackendBootstrap } from "@/lib/api-client";

export default function VitalsPage() {
  const { selectedWorkplaceId, workContext } = useMode();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeId, setActiveId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bp: "", pulse: "", temp: "", spo2: "", weight: "" });
  const [isLoadingVitals, setIsLoadingVitals] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");

  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const active = contextPatients.find((p) => p.id === activeId) ?? contextPatients[0];

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        setPatients(data.patients);
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setSyncMessage("Unable to load patients from the backend.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVitals(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveId((current) =>
      contextPatients.some((patient) => patient.id === current) ? current : contextPatients[0]?.id ?? current
    );
  }, [contextPatients]);

  if (isLoadingVitals) {
    return (
      <div>
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card padded={false}>
            <div className="px-4 pt-4 pb-2">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="divide-y divide-line">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <Skeleton className="mb-4 h-5 w-56" />
              <div className="vitals-strip">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="vitals-cell">
                    <Skeleton className="h-3 w-16 bg-white/15" />
                    <Skeleton className="mt-3 h-8 w-20 bg-white/20" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  async function logVitals() {
    if (!active || !form.bp || !form.pulse) return;
    const heightM = 1.7; // assumed constant for BMI recompute demo
    const weight = Number(form.weight) || active.latestVitals?.weight || 0;
    const newVitals: Vitals = {
      recordedAt: new Date().toISOString(),
      bp: form.bp,
      pulse: Number(form.pulse),
      temp: Number(form.temp) || active.latestVitals?.temp || 98.6,
      spo2: Number(form.spo2) || active.latestVitals?.spo2 || 98,
      weight,
      bmi: weight ? Math.round((weight / (heightM * heightM)) * 10) / 10 : active.latestVitals?.bmi || 0,
    };
    try {
      const savedVitals = await createBackendVitals({
        patientId: activeId,
        workplaceId: selectedWorkplaceId,
        bp: newVitals.bp,
        pulse: newVitals.pulse,
        temp: newVitals.temp,
        spo2: newVitals.spo2,
        weight: newVitals.weight,
        bmi: newVitals.bmi,
      });
      newVitals.recordedAt = savedVitals.recordedAt;
      setSyncMessage("Vitals synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "vitals were not saved."}`);
      return;
    }
    setPatients((prev) => prev.map((p) => (p.id === activeId ? { ...p, latestVitals: newVitals } : p)));
    setForm({ bp: "", pulse: "", temp: "", spo2: "", weight: "" });
    setShowForm(false);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="06 - Vitals Management"
        title="Vitals Management"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Log Reading
          </button>
        }
        description={`Review and update ${workContext} patient vitals: blood pressure, pulse, temperature, oxygen saturation, weight and BMI.`}
      />

      <Modal
        open={showForm}
        title="Log New Reading"
        eyebrow={active?.name ?? "Patient"}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={logVitals} className="btn-primary">
              <Plus size={14} /> Save Reading
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">BP (mmHg)</label>
            <input
              value={form.bp}
              onChange={(e) => setForm({ ...form, bp: e.target.value })}
              placeholder="120/80"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Pulse (bpm)</label>
            <input
              value={form.pulse}
              onChange={(e) => setForm({ ...form, pulse: e.target.value })}
              placeholder="72"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Temp (Â°F)</label>
            <input
              value={form.temp}
              onChange={(e) => setForm({ ...form, temp: e.target.value })}
              placeholder="98.6"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">SpO2 (%)</label>
            <input
              value={form.spo2}
              onChange={(e) => setForm({ ...form, spo2: e.target.value })}
              placeholder="98"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-muted block mb-1">Weight (kg)</label>
            <input
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="70"
              className="input-field"
            />
          </div>
        </div>
      </Modal>
      {syncMessage && <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>}

      {active && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padded={false} className="lg:col-span-1">
          <div className="px-4 pt-4 pb-2">
            <p className="eyebrow">Select Patient</p>
          </div>
          <div className="divide-y divide-line max-h-[560px] overflow-y-auto">
            {contextPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeId === p.id ? "bg-brand-50" : "hover:bg-paper"
                }`}
              >
                <Avatar initials={p.avatarInitials} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink truncate">{p.name}</p>
                  <p className="text-xs text-ink-muted">
                    {p.latestVitals ? `BP ${p.latestVitals.bp}` : "No vitals recorded"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-brand-600" />
              <h2 className="font-display text-lg text-ink">{active.name} — Current Vitals</h2>
            </div>
            {active.latestVitals ? (
              <div className="vitals-strip">
                <div className="vitals-cell">
                  <span className="vitals-label">BP</span>
                  <span className="vitals-value">
                    {active.latestVitals.bp}
                    <span className="vitals-unit">mmHg</span>
                  </span>
                </div>
                <div className="vitals-cell">
                  <span className="vitals-label">Pulse</span>
                  <span className="vitals-value">
                    {active.latestVitals.pulse}
                    <span className="vitals-unit">bpm</span>
                  </span>
                </div>
                <div className="vitals-cell">
                  <span className="vitals-label">Temp</span>
                  <span className="vitals-value">
                    {active.latestVitals.temp}
                    <span className="vitals-unit">°F</span>
                  </span>
                </div>
                <div className="vitals-cell">
                  <span className="vitals-label">SpO2</span>
                  <span className="vitals-value">
                    {active.latestVitals.spo2}
                    <span className="vitals-unit">%</span>
                  </span>
                </div>
                <div className="vitals-cell">
                  <span className="vitals-label">Weight / BMI</span>
                  <span className="vitals-value">
                    {active.latestVitals.weight}
                    <span className="vitals-unit">kg · {active.latestVitals.bmi}</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No vitals recorded yet for this patient.</p>
            )}
          </Card>

          <div className="hidden">
            <h2 className="font-display text-lg text-ink mb-4">Log New Reading</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">BP (mmHg)</label>
                <input
                  value={form.bp}
                  onChange={(e) => setForm({ ...form, bp: e.target.value })}
                  placeholder="120/80"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">Pulse (bpm)</label>
                <input
                  value={form.pulse}
                  onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                  placeholder="72"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">Temp (°F)</label>
                <input
                  value={form.temp}
                  onChange={(e) => setForm({ ...form, temp: e.target.value })}
                  placeholder="98.6"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">SpO2 (%)</label>
                <input
                  value={form.spo2}
                  onChange={(e) => setForm({ ...form, spo2: e.target.value })}
                  placeholder="98"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">Weight (kg)</label>
                <input
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="70"
                  className="input-field"
                />
              </div>
            </div>
            <button onClick={logVitals} className="btn-primary">
              <Plus size={14} /> Save Reading
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
