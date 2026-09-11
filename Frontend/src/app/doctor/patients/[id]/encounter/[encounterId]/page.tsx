"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardPlus, FlaskConical, PillIcon, ScanLine, Stethoscope } from "lucide-react";
import { ConsultationForm } from "@/components/doctor-consultation-form";
import { WorkplaceBadge } from "@/components/doctor-workflow";
import { Avatar, Card, Field, Pill, SectionHeading } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { EncounterDraft } from "@/lib/doctor-workflow-types";
import { useMode } from "@/lib/mode-context";
import { completeBackendEncounter } from "@/lib/api-client";

const initialDraft: EncounterDraft = {
  chiefComplaint: "",
  symptoms: "",
  examination: "",
  vitals: "BP 126/82, Pulse 78, SpO2 98%",
  diagnosis: "",
  icdCode: "",
  notes: "",
  treatmentPlan: "",
  prescription: "",
  labOrder: "",
  radiologyOrder: "",
  followUp: "",
};

export default function EncounterPage() {
  const params = useParams<{ id: string; encounterId: string }>();
  const { workContext } = useMode();
  const {
    backendDoctorId,
    clinicQueue,
    completeHospitalItem,
    getWorkplace,
    hospitalWorklist,
    patients,
  } = useDoctorWorkflow();
  const patient = patients.find((entry) => entry.id === params.id);
  const queueItem = clinicQueue.find((item) => item.id === params.encounterId);
  const hospitalItem = hospitalWorklist.find((item) => item.id === params.encounterId);
  const workplace = getWorkplace(queueItem?.workplaceId ?? hospitalItem?.workplaceId ?? "");
  const [draft, setDraft] = useState<EncounterDraft>(() => ({
    ...initialDraft,
    chiefComplaint: queueItem?.reason ?? hospitalItem?.diagnosis ?? "",
    diagnosis: hospitalItem?.diagnosis ?? "",
    treatmentPlan: hospitalItem?.pending?.join("\n") ?? "",
  }));
  const [saved, setSaved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const encounterType = queueItem ? "Clinic consultation" : hospitalItem ? "Hospital review" : "Encounter";
  const allergies = patient?.allergies ?? [];
  const summaryItems = useMemo(
    () => [
      { label: "MRN", value: patient?.mrn ?? "-" },
      { label: "Age / Gender", value: patient ? `${patient.age} / ${patient.gender}` : "-" },
      { label: "Last visit", value: patient?.lastVisit ?? "-" },
      { label: "Blood group", value: patient?.bloodGroup ?? "-" },
    ],
    [patient]
  );

  function update(field: keyof EncounterDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function saveDraft() {
    if (!patient || !backendDoctorId || !workplace) return;
    try {
      await completeBackendEncounter({
        patientId: patient.id,
        doctorId: backendDoctorId,
        workplaceId: workplace.id,
        appointmentId: queueItem?.id,
        encounterId: hospitalItem?.encounterId,
        workContext,
        complete: false,
        ...draft,
      });
      setSaved(true);
      setSyncMessage("Draft saved to backend.");
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "draft was not saved."}`);
    }
  }

  async function completeEncounter() {
    if (!patient || !backendDoctorId || !workplace) return;
    try {
      await completeBackendEncounter({
        patientId: patient.id,
        doctorId: backendDoctorId,
        workplaceId: workplace.id,
        appointmentId: queueItem?.id,
        encounterId: hospitalItem?.encounterId,
        workContext,
        complete: true,
        ...draft,
      });
      setSyncMessage("Encounter synced to backend.");
      if (hospitalItem) completeHospitalItem(hospitalItem.id);
      setCompleted(true);
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "encounter was not completed."}`);
    }
  }

  if (!patient) {
    return (
      <Card>
        <h1 className="font-display text-xl text-ink">Patient not found</h1>
        <Link href="/doctor/patients" className="btn-secondary mt-4">
          Back to patients
        </Link>
      </Card>
    );
  }

  if (queueItem) {
    return (
      <div>
        <div className="mb-4">
          <Link href="/doctor/queue" className="btn-secondary">
            <ArrowLeft size={15} /> Back to Queue
          </Link>
        </div>
        <ConsultationForm
          patients={patients}
          appointmentId={queueItem.id}
          workplaceId={queueItem.workplaceId}
          preselectedPatientId={patient.id}
          initialComplaint={queueItem.reason}
          labOrderMode="modal"
          prescriptionMode="modal"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Unified Encounter"
        title={encounterType}
        description="Document history, examination, diagnosis, orders, prescription, follow-up and final notes in one workflow."
        action={
          <Link href={hospitalItem ? "/doctor/hospital-duty" : "/doctor/queue"} className="btn-secondary">
            <ArrowLeft size={15} /> Back
          </Link>
        }
      />

      <Card className="!p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Avatar initials={patient.avatarInitials} size={46} />
            <div>
              <h2 className="text-lg font-semibold text-ink">{patient.name}</h2>
              <p className="text-xs text-ink-muted">
                {patient.phone} - Primary doctor case - {encounterType}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <WorkplaceBadge workplace={workplace} />
            {hospitalItem && <Pill tone={hospitalItem.priority === "Critical" ? "alert" : "brand"}>{hospitalItem.priority}</Pill>}
            {completed && <Pill tone="sage">Completed</Pill>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-md border border-line bg-paper px-3 py-2">
              <p className="eyebrow">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
        {allergies.length > 0 && (
          <div className="mt-4 rounded-md border border-alert-100 bg-alert-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-alert-500">Allergy alert</p>
            <p className="mt-1 text-sm text-ink">{allergies.map((allergy) => `${allergy.substance} (${allergy.severity})`).join(", ")}</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <Stethoscope size={18} className="text-brand-700" />
            <h2 className="font-display text-xl text-ink">Clinical Note</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Chief complaint">
              <textarea value={draft.chiefComplaint} onChange={(event) => update("chiefComplaint", event.target.value)} rows={3} className="input-field resize-none" />
            </Field>
            <Field label="Symptoms">
              <textarea value={draft.symptoms} onChange={(event) => update("symptoms", event.target.value)} rows={3} className="input-field resize-none" />
            </Field>
            <Field label="Examination">
              <textarea value={draft.examination} onChange={(event) => update("examination", event.target.value)} rows={4} className="input-field resize-none" />
            </Field>
            <Field label="Vitals">
              <textarea value={draft.vitals} onChange={(event) => update("vitals", event.target.value)} rows={4} className="input-field resize-none" />
            </Field>
            <Field label="Diagnosis">
              <textarea value={draft.diagnosis} onChange={(event) => update("diagnosis", event.target.value)} rows={3} className="input-field resize-none" />
            </Field>
            <Field label="ICD code">
              <input value={draft.icdCode} onChange={(event) => update("icdCode", event.target.value)} placeholder="Example: E11.9" className="input-field" />
            </Field>
            <Field label="Treatment plan" className="md:col-span-2">
              <textarea value={draft.treatmentPlan} onChange={(event) => update("treatmentPlan", event.target.value)} rows={4} className="input-field resize-none" />
            </Field>
            <Field label="Private notes" className="md:col-span-2">
              <textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} className="input-field resize-none" />
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2">
              <PillIcon size={17} className="text-brand-700" />
              <h3 className="text-sm font-semibold text-ink">Prescription</h3>
            </div>
            <textarea value={draft.prescription} onChange={(event) => update("prescription", event.target.value)} rows={4} className="input-field mt-3 resize-none" placeholder="Medicine, dosage, frequency..." />
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <FlaskConical size={17} className="text-clay-600" />
              <h3 className="text-sm font-semibold text-ink">Lab Orders</h3>
            </div>
            <textarea value={draft.labOrder} onChange={(event) => update("labOrder", event.target.value)} rows={3} className="input-field mt-3 resize-none" placeholder="CBC, HbA1c, Troponin..." />
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <ScanLine size={17} className="text-sage-500" />
              <h3 className="text-sm font-semibold text-ink">Radiology</h3>
            </div>
            <textarea value={draft.radiologyOrder} onChange={(event) => update("radiologyOrder", event.target.value)} rows={3} className="input-field mt-3 resize-none" placeholder="X-ray chest, CT, MRI..." />
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <ClipboardPlus size={17} className="text-brand-700" />
              <h3 className="text-sm font-semibold text-ink">Follow-up</h3>
            </div>
            <textarea value={draft.followUp} onChange={(event) => update("followUp", event.target.value)} rows={3} className="input-field mt-3 resize-none" placeholder="Review after 7 days..." />
          </Card>
        </div>
      </div>

      <Card className="sticky bottom-4 z-20 !p-3 shadow-lift">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-ink-muted">
            {syncMessage || (saved ? "Draft saved to backend" : completed ? "Encounter completed" : "Unsaved encounter draft")}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveDraft} className="btn-secondary">
              Save Draft
            </button>
            <button type="button" onClick={completeEncounter} className="btn-primary">
              <CheckCircle2 size={15} /> Complete Encounter
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
