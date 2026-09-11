"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Send, Trash2 } from "lucide-react";
import { Field, Modal, Skeleton } from "@/components/ui";
import { CURRENT_DATE_ISO } from "@/lib/app-time";
import { ApiSyncSkippedError, createBackendPrescription, getBackendBootstrap } from "@/lib/api-client";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { patients as seedPatients, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { Medicine, Patient, Prescription } from "@/lib/types";

function emptyMedicine(): Medicine {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
  return { id, name: "", dosage: "", frequency: "", duration: "", instructions: "" };
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

interface PrescriptionIssueModalProps {
  open: boolean;
  onClose: () => void;
  patients?: Patient[];
  preselectedPatientId?: string | null;
}

export function PrescriptionIssueModal({
  open,
  onClose,
  patients = seedPatients,
  preselectedPatientId,
}: PrescriptionIssueModalProps) {
  const { selectedWorkplaceId, workContext } = useMode();
  const { addPrescription } = useDoctorWorkflow();
  const [backendDoctorId, setBackendDoctorId] = useState("doc-1");
  const [patientId, setPatientId] = useState(preselectedPatientId ?? "");
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()]);
  const [advice, setAdvice] = useState("");
  const [signed, setSigned] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [isLoadingDoctorData, setIsLoadingDoctorData] = useState(true);

  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const activePatient = contextPatients.find((patient) => patient.id === patientId);
  const filledMedicineNames = medicines.map((medicine) => medicine.name.trim().toLowerCase()).filter(Boolean);
  const duplicateMedicineNames = filledMedicineNames.filter(
    (name, index) => filledMedicineNames.indexOf(name) !== index
  );
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
        if (!cancelled) setBackendDoctorId(data.currentDoctorId ?? data.doctors[0]?.id ?? "doc-1");
      })
      .catch(() => {
        if (!cancelled) setBackendDoctorId("doc-1");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDoctorData(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPatientId((current) => {
      if (preselectedPatientId && contextPatients.some((patient) => patient.id === preselectedPatientId)) {
        return preselectedPatientId;
      }
      return contextPatients.some((patient) => patient.id === current) ? current : contextPatients[0]?.id ?? current;
    });
  }, [contextPatients, preselectedPatientId]);

  function updateMedicine(id: string, field: keyof Medicine, value: string) {
    setMedicines((prev) => prev.map((medicine) => (medicine.id === id ? { ...medicine, [field]: value } : medicine)));
  }

  function resetForm() {
    setMedicines([emptyMedicine()]);
    setAdvice("");
    setSigned(false);
    setSyncMessage("");
  }

  async function issuePrescription() {
    const filled = medicines.filter((medicine) => medicine.name.trim());
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
      if (!(error instanceof ApiSyncSkippedError)) {
        setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "prescription was not saved."}`);
        return;
      }
      setSyncMessage("Mock prescription saved locally for this session.");
    }

    addPrescription(nextPrescription);
    resetForm();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New Prescription"
      eyebrow="E-Prescription"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button
            onClick={issuePrescription}
            disabled={isLoadingDoctorData || !signed || duplicateMedicineNames.length > 0 || incompleteMedicines.length > 0}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={14} /> Issue Prescription
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          {syncMessage && <span className="text-xs text-ink-muted">{syncMessage}</span>}
        </>
      }
    >
      {isLoadingDoctorData ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-card border border-line p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full sm:col-span-2" />
              </div>
            </div>
          ))}
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
      <label className="eyebrow block mb-1.5">Patient</label>
      <select value={patientId} onChange={(event) => setPatientId(event.target.value)} className="input-field mb-5">
        {contextPatients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name} - {patient.mrn}
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
        {medicines.map((medicine, index) => (
          <div key={medicine.id} className="border border-line rounded-card p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-medium text-ink-muted">Medicine {index + 1}</p>
              {medicines.length > 1 && (
                <button onClick={() => setMedicines(medicines.filter((item) => item.id !== medicine.id))}>
                  <Trash2 size={14} className="text-ink-faint hover:text-alert-500" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Field label="Medicine Name">
                <input
                  list="medicine-templates"
                  placeholder="Medicine name"
                  value={medicine.name}
                  onChange={(event) => updateMedicine(medicine.id, "name", event.target.value)}
                  className="input-field"
                />
                <datalist id="medicine-templates">
                  {medicineTemplates.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
              <Field label="Dosage">
                <input
                  placeholder="Dosage (500mg)"
                  value={medicine.dosage}
                  onChange={(event) => updateMedicine(medicine.id, "dosage", event.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Frequency">
                <input
                  placeholder="Frequency (1-0-1)"
                  value={medicine.frequency}
                  onChange={(event) => updateMedicine(medicine.id, "frequency", event.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Duration">
                <input
                  placeholder="Duration (7 days)"
                  value={medicine.duration}
                  onChange={(event) => updateMedicine(medicine.id, "duration", event.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Instructions" className="sm:col-span-2">
                <input
                  placeholder="Instructions (after food)"
                  value={medicine.instructions}
                  onChange={(event) => updateMedicine(medicine.id, "instructions", event.target.value)}
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
        onChange={(event) => setAdvice(event.target.value)}
        rows={3}
        placeholder="Diet, lifestyle notes, warning signs to watch for..."
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
        </>
      )}
    </Modal>
  );
}
