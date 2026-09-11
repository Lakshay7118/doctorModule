"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, Modal, SectionSkeleton, TableSkeleton } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { DiagnosisEntry, Patient } from "@/lib/types";
import { CURRENT_DATE_ISO } from "@/lib/app-time";
import { createBackendDiagnosis, getBackendBootstrap } from "@/lib/api-client";

const icdReference = [
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "J44.9", description: "Chronic obstructive pulmonary disease, unspecified" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery" },
  { code: "G43.909", description: "Migraine, unspecified, not intractable" },
  { code: "E03.9", description: "Hypothyroidism, unspecified" },
  { code: "M54.5", description: "Low back pain" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "K21.9", description: "Gastro-esophageal reflux disease without esophagitis" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "L20.9", description: "Atopic dermatitis, unspecified" },
];

export default function DiagnosisPage() {
  const { selectedWorkplaceId, workContext } = useMode();
  const [dxList, setDxList] = useState<DiagnosisEntry[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [icdQuery, setIcdQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [selectedCode, setSelectedCode] = useState<{ code: string; description: string } | null>(null);
  const [isLoadingDiagnosis, setIsLoadingDiagnosis] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const contextDxList = dxList.filter((dx) => matchesWorkContext(dx, workContext));
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        setPatients(data.patients);
        setDxList(data.diagnoses);
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
        setDxList([]);
        setSyncMessage("Unable to load diagnoses from the backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDiagnosis(false);
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

  const icdResults = useMemo(() => {
    const q = icdQuery.trim().toLowerCase();
    if (!q) return icdReference;
    return icdReference.filter((c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [icdQuery]);

  if (isLoadingDiagnosis) {
    return (
      <div>
        <SectionSkeleton />
        <TableSkeleton columns={5} rows={7} />
      </div>
    );
  }

  async function addDiagnosis() {
    if (!selectedCode) return;
    let nextDiagnosis: DiagnosisEntry = {
      id: `dx-${Date.now()}`,
      patientId,
      icdCode: selectedCode.code,
      description: selectedCode.description,
      diagnosedOn: CURRENT_DATE_ISO,
      status: "Active",
      doctorId: "doc-1",
      workContext,
    };
    try {
      nextDiagnosis = await createBackendDiagnosis({
        patientId,
        workplaceId: selectedWorkplaceId,
        icdCode: selectedCode.code,
        description: selectedCode.description,
      });
      setSyncMessage("Diagnosis synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "diagnosis was not saved."}`);
      return;
    }
    setDxList((prev) => [nextDiagnosis, ...prev]);
    setSelectedCode(null);
    setShowForm(false);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="08 - Diagnosis & ICD Management"
        title="Diagnosis & ICD Management"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Add Diagnosis
          </button>
        }
        description={`Document ${workContext} clinical diagnoses using standardized ICD codes to maintain accurate records and reporting.`}
      />

      <Modal
        open={showForm}
        title="Add Diagnosis"
        eyebrow="Diagnosis & ICD"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={addDiagnosis} disabled={!selectedCode} className="btn-primary">
              <Plus size={14} /> Add to Patient Record
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
            <label className="text-[11px] text-ink-muted block mb-1">Patient</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-field mb-3">
              {contextPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label className="text-[11px] text-ink-muted block mb-1">ICD Code Search</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={icdQuery}
                onChange={(e) => setIcdQuery(e.target.value)}
                placeholder="Search ICD-10 code or condition…"
                className="input-field pl-8"
              />
            </div>
            <div className="max-h-56 overflow-y-auto border border-line rounded-md divide-y divide-line mb-3">
              {icdResults.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelectedCode(c)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-brand-50 transition-colors ${
                    selectedCode?.code === c.code ? "bg-brand-50" : ""
                  }`}
                >
                  <span className="font-mono font-medium text-brand-700">{c.code}</span>
                  <span className="text-ink-soft ml-2">{c.description}</span>
                </button>
              ))}
              {icdResults.length === 0 && <p className="text-xs text-ink-muted px-3 py-3">No matching codes.</p>}
            </div>
      </Modal>
      {syncMessage && <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>}

      <div>
          <Card padded={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-display text-lg text-ink">All Diagnoses</h2>
            </div>
            <table className="w-full table-clean">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>ICD Code</th>
                  <th>Description</th>
                  <th>Diagnosed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contextDxList.map((d) => {
                  const patient = patientById.get(d.patientId);
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {patient && <Avatar initials={patient.avatarInitials} size={26} />}
                          {patient?.name}
                        </div>
                      </td>
                      <td className="font-mono">{d.icdCode}</td>
                      <td>{d.description}</td>
                      <td className="font-mono text-xs">{d.diagnosedOn}</td>
                      <td>
                        <Pill tone={d.status === "Chronic" ? "clay" : d.status === "Active" ? "alert" : "sage"}>
                          {d.status}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
    </div>
  );
}
