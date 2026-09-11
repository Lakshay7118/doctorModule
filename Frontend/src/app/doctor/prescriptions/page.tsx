"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Download, Plus, Printer, Trash2, Send } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, Modal, Field, ListSkeleton, SectionSkeleton } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { Medicine, Patient, Prescription } from "@/lib/types";
import { CURRENT_DATE_ISO } from "@/lib/app-time";
import { createBackendPrescription, getBackendBootstrap } from "@/lib/api-client";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";

function emptyMedicine(): Medicine {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), name: "", dosage: "", frequency: "", duration: "", instructions: "" };
}

const medicineTemplates = [
  "Amlodipine",
  "Amoxicillin",
  "Aspirin",
  "Atorvastatin",
  "Azithromycin",
  "Clopidogrel",
  "Metformin",
  "Pantoprazole",
  "Paracetamol",
  "Salbutamol Inhaler",
];

function PrescriptionBuilder() {
  const params = useSearchParams();
  const preselected = params.get("patient");
  const { selectedWorkplaceId, workContext } = useMode();
  const { addPrescription } = useDoctorWorkflow();
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState(preselected ?? "");
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()]);
  const [advice, setAdvice] = useState("");
  const [signed, setSigned] = useState(false);
  const [sent, setSent] = useState(false);
  const [isLoadingPrescriptions, setIsLoadingPrescriptions] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const contextRxList = rxList.filter((rx) => matchesWorkContext(rx, workContext));
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const activePatient = contextPatients.find((patient) => patient.id === patientId);
  const filledMedicineNames = medicines.map((medicine) => medicine.name.trim().toLowerCase()).filter(Boolean);
  const duplicateMedicineNames = filledMedicineNames.filter((name, index) => filledMedicineNames.indexOf(name) !== index);
  const allergyMatches =
    activePatient?.allergies.filter((allergy) =>
      filledMedicineNames.some((medicineName) => medicineName.includes(allergy.substance.toLowerCase()))
    ) ?? [];
  const incompleteMedicines = medicines.filter(
    (medicine) => medicine.name.trim() && (!medicine.dosage.trim() || !medicine.frequency.trim() || !medicine.duration.trim())
  );

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        setPatients(data.patients);
        setRxList(data.prescriptions);
        setBackendDoctorId(data.currentDoctorId ?? data.doctors[0]?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
        setRxList([]);
        setBackendDoctorId("");
        setSyncMessage("Unable to load prescriptions from the backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPrescriptions(false);
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

  if (isLoadingPrescriptions) {
    return (
      <div>
        <SectionSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  function updateMed(id: string, field: keyof Medicine, value: string) {
    setMedicines((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  async function issue() {
    const filled = medicines.filter((m) => m.name.trim());
    if (filled.length === 0 || duplicateMedicineNames.length > 0 || !signed) return;
    let nextPrescription: Prescription = {
      id: `rx-${Date.now()}`,
      patientId,
      doctorId: backendDoctorId,
      date: CURRENT_DATE_ISO,
      medicines: filled,
      advice,
      status: "Active",
      workplaceId: selectedWorkplaceId,
      workContext,
    };
    try {
      nextPrescription = await createBackendPrescription({
        patientId,
        doctorId: backendDoctorId,
        workplaceId: selectedWorkplaceId,
        advice,
        medicines: filled,
      });
      setSyncMessage("Prescription synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "prescription was not saved."}`);
      return;
    }
    addPrescription(nextPrescription);
    setRxList((prev) => [nextPrescription, ...prev]);
    setMedicines([emptyMedicine()]);
    setAdvice("");
    setSigned(false);
    setSent(true);
    setShowForm(false);
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="07 - E-Prescription"
        title="E-Prescription"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> New Prescription
          </button>
        }
        description={`Create ${workContext} prescriptions with medicines, dosage instructions, treatment duration and patient guidance.`}
      />

      <Modal
        open={showForm}
        title="New Prescription"
        eyebrow="E-Prescription"
        onClose={() => setShowForm(false)}
        size="xl"
        footer={
          <>
            <button
              onClick={issue}
              disabled={!signed || duplicateMedicineNames.length > 0 || incompleteMedicines.length > 0}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} /> Issue Prescription
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
            <label className="eyebrow block mb-1.5">Patient</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-field mb-5">
              {contextPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.mrn}
                </option>
              ))}
            </select>

            {(allergyMatches.length > 0 || duplicateMedicineNames.length > 0 || incompleteMedicines.length > 0) && (
              <div className="mb-4 space-y-2">
                {allergyMatches.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-alert-100 bg-alert-50 px-3 py-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-alert-500" />
                    <p className="text-xs leading-5 text-ink-soft">
                      Allergy warning: {activePatient?.name} has {allergyMatches.map((allergy) => allergy.substance).join(", ")} on file.
                    </p>
                  </div>
                )}
                {duplicateMedicineNames.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-alert-100 bg-alert-50 px-3 py-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-alert-500" />
                    <p className="text-xs leading-5 text-ink-soft">Duplicate medicine detected. Remove duplicate entries before issuing.</p>
                  </div>
                )}
                {incompleteMedicines.length > 0 && (
                  <div className="rounded-md border border-clay-100 bg-clay-50 px-3 py-2 text-xs leading-5 text-ink-soft">
                    Add dosage, frequency and duration for every medicine before final issue.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 mb-4">
              {medicines.map((m, idx) => (
                <div key={m.id} className="border border-line rounded-card p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-medium text-ink-muted">Medicine {idx + 1}</p>
                    {medicines.length > 1 && (
                      <button onClick={() => setMedicines(medicines.filter((x) => x.id !== m.id))}>
                        <Trash2 size={14} className="text-ink-faint hover:text-alert-500" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="Medicine Name">
                    <input
                      list="medicine-templates"
                      placeholder="Medicine name"
                      value={m.name}
                      onChange={(e) => updateMed(m.id, "name", e.target.value)}
                      className="input-field"
                    />
                    <datalist id="medicine-templates">
                      {medicineTemplates.map((medicine) => (
                        <option key={medicine} value={medicine} />
                      ))}
                    </datalist>
                    </Field>
                    <Field label="Dosage">
                    <input
                      placeholder="Dosage (500mg)"
                      value={m.dosage}
                      onChange={(e) => updateMed(m.id, "dosage", e.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Frequency">
                    <input
                      placeholder="Frequency (1-0-1)"
                      value={m.frequency}
                      onChange={(e) => updateMed(m.id, "frequency", e.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Duration">
                    <input
                      placeholder="Duration (7 days)"
                      value={m.duration}
                      onChange={(e) => updateMed(m.id, "duration", e.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Instructions" className="sm:col-span-2">
                    <input
                      placeholder="Instructions (after food)"
                      value={m.instructions}
                      onChange={(e) => updateMed(m.id, "instructions", e.target.value)}
                      className="input-field"
                    />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setMedicines([...medicines, emptyMedicine()])} className="btn-secondary mb-5">
              <Plus size={14} /> Add Medicine
            </button>

            <label className="eyebrow block mb-1.5">Patient Guidance</label>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              rows={3}
              placeholder="Diet, lifestyle notes, warning signs to watch for…"
              className="input-field resize-none mb-4"
            />

            <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <input
                type="checkbox"
                checked={signed}
                onChange={(event) => setSigned(event.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              Apply e-signature before issue
            </label>

      </Modal>
      {sent && <span className="text-xs text-sage-500 mb-3 inline-block">Prescription issued and signed</span>}
      {syncMessage && <span className="ml-3 text-xs text-ink-muted">{syncMessage}</span>}

        <div>
          <Card padded={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-display text-lg text-ink">Recent {workContext} Prescriptions</h2>
            </div>
            <div className="divide-y divide-line max-h-[640px] overflow-y-auto">
              {contextRxList.map((rx) => {
                const patient = patientById.get(rx.patientId);
                return (
                  <div key={rx.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {patient && <Avatar initials={patient.avatarInitials} size={26} />}
                      <p className="text-[13px] font-medium text-ink">{patient?.name}</p>
                      <Pill tone={rx.status === "Active" ? "brand" : "neutral"}>{rx.status}</Pill>
                      <button type="button" onClick={() => window.print()} className="btn-ghost ml-auto text-xs">
                        <Printer size={12} /> Print
                      </button>
                      <button type="button" className="btn-ghost text-xs">
                        <Download size={12} /> PDF
                      </button>
                    </div>
                    <p className="text-xs text-ink-muted">{rx.medicines.map((m) => m.name).join(", ") || "—"}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{rx.date}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  return (
    <Suspense fallback={<><SectionSkeleton /><ListSkeleton rows={6} /></>}>
      <PrescriptionBuilder />
    </Suspense>
  );
}
