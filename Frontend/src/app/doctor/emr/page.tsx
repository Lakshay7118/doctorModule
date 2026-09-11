"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, FlaskConical, Pill as PillIcon, ScanLine } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, EmptyState } from "@/components/ui";
import { useMode } from "@/lib/mode-context";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";

type RecordType = "all" | "diagnosis" | "prescription" | "lab" | "radiology" | "allergy";

interface RecordRow {
  type: Exclude<RecordType, "all">;
  patientId: string;
  title: string;
  meta: string;
  date: string;
}

export default function EMRPage() {
  const { workContext } = useMode();
  const { diagnoses, labOrders, patients, prescriptions, radiologyOrders } = useDoctorWorkflow();
  const [filter, setFilter] = useState<RecordType>("all");
  const [query, setQuery] = useState("");
  const contextPatients = useMemo(
    () => patients.filter((patient) => patient.workContexts?.includes(workContext) ?? true),
    [patients, workContext]
  );

  const rows: RecordRow[] = useMemo(() => {
    const out: RecordRow[] = [];
    diagnoses.filter((d) => !d.workplaceId || d.workContext === workContext).forEach((d) =>
      out.push({ type: "diagnosis", patientId: d.patientId, title: `${d.icdCode} — ${d.description}`, meta: d.status, date: d.diagnosedOn })
    );
    prescriptions.filter((rx) => !rx.workplaceId || rx.workContext === workContext).forEach((rx) =>
      out.push({
        type: "prescription",
        patientId: rx.patientId,
        title: rx.medicines.map((m) => m.name).join(", "),
        meta: rx.status,
        date: rx.date,
      })
    );
    labOrders.filter((l) => !l.workplaceId || l.workContext === workContext).forEach((l) =>
      out.push({ type: "lab", patientId: l.patientId, title: l.testName, meta: l.status, date: l.orderedOn })
    );
    radiologyOrders.filter((r) => !r.workplaceId || r.workContext === workContext).forEach((r) =>
      out.push({
        type: "radiology",
        patientId: r.patientId,
        title: `${r.imagingType} — ${r.bodyRegion}`,
        meta: r.status,
        date: r.orderedOn,
      })
    );
    contextPatients.forEach((p) =>
      p.allergies.forEach((a) =>
        out.push({
          type: "allergy",
          patientId: p.id,
          title: `${a.substance} — ${a.reaction}`,
          meta: a.severity,
          date: "On file",
        })
      )
    );
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [contextPatients, diagnoses, labOrders, patients, prescriptions, radiologyOrders, workContext]);

  const icons: Record<Exclude<RecordType, "all">, typeof FileText> = {
    diagnosis: FileText,
    prescription: PillIcon,
    lab: FlaskConical,
    radiology: ScanLine,
    allergy: AlertTriangle,
  };

  const filtered = rows.filter((r) => {
    const patient = patients.find((p) => p.id === r.patientId);
    const matchesType = filter === "all" || r.type === filter;
    const matchesQuery = !query || patient?.name.toLowerCase().includes(query.toLowerCase()) || r.title.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });

  const tabs: { label: string; value: RecordType }[] = [
    { label: "All Records", value: "all" },
    { label: "Diagnoses", value: "diagnosis" },
    { label: "Prescriptions", value: "prescription" },
    { label: "Lab Investigations", value: "lab" },
    { label: "Radiology", value: "radiology" },
    { label: "Allergies", value: "allergy" },
  ];

  return (
    <div>
      <SectionHeading
        eyebrow="04 - Medical Records (EMR)"
        title="Electronic Medical Records"
        description={`Complete ${workContext} record of diagnoses, prescriptions, investigations, allergies and treatment history across your patients.`}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`badge border ${filter === t.value ? "bg-brand-500 text-white border-brand-500" : "border-line text-ink-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search records or patient…"
          className="input-field max-w-xs"
        />
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState title="No records match" description="Try a different filter or search term." />
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((r, i) => {
              const patient = patients.find((p) => p.id === r.patientId);
              const Icon = icons[r.type];
              return (
                <Link
                  key={i}
                  href={`/doctor/patients/${r.patientId}`}
                  className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-brand-50/40 transition-colors"
                >
                  <span className="w-8 h-8 rounded-md bg-paper border border-line flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-brand-600" />
                  </span>
                  {patient && <Avatar initials={patient.avatarInitials} size={28} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink font-medium truncate">{r.title}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {patient?.name} · {r.date}
                    </p>
                  </div>
                  <Pill tone="neutral">{r.meta}</Pill>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
