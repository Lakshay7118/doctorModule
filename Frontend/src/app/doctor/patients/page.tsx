"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, EmptyState, Modal, Field, ListSkeleton, SectionSkeleton } from "@/components/ui";
import { useMode } from "@/lib/mode-context";
import { Doctor, Patient } from "@/lib/types";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import {
  createBackendPatient,
  deleteBackendPatient,
  getBackendPatients,
  isUuid,
  updateBackendPatient,
} from "@/lib/api-client";

const tagTone: Record<string, "brand" | "clay" | "alert" | "sage"> = {
  New: "brand",
  "Follow-up": "clay",
  Critical: "alert",
  "Shared-care": "sage",
};

const PAGE_SIZE = 10;

function birthDateFromAge(age: number) {
  if (!Number.isFinite(age) || age <= 0) return undefined;
  return `${new Date().getFullYear() - Math.floor(age)}-01-01`;
}

export default function PatientsPage() {
  const { selectedWorkplaceId, workContext } = useMode();
  const { doctors, isLoadingWorkflow, workflowError } = useDoctorWorkflow();
  const [patientRows, setPatientRows] = useState<Patient[]>([]);
  const [doctorRows, setDoctorRows] = useState<Doctor[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientLoadError, setPatientLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "Male" as Patient["gender"],
    phone: "",
    bloodGroup: "O+",
    condition: "",
    doctorId: "",
  });

  useEffect(() => {
    setDoctorRows(doctors);
    setForm((prev) => ({ ...prev, doctorId: prev.doctorId || doctors[0]?.id || "" }));
  }, [doctors]);

  useEffect(() => {
    setPage(0);
  }, [query, selectedWorkplaceId, tagFilter]);

  useEffect(() => {
    if (isLoadingWorkflow) return;
    if (!isUuid(selectedWorkplaceId)) {
      setPatientRows([]);
      setTotalPatients(0);
      setIsLoadingPatients(false);
      setPatientLoadError(workflowError || "Select a database-backed workplace to load patients.");
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setIsLoadingPatients(true);
      setPatientLoadError("");
      getBackendPatients({
        workplaceId: selectedWorkplaceId,
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        search: query,
      })
        .then((result) => {
          if (cancelled) return;
          setPatientRows(result.items);
          setTotalPatients(result.total);
          setSyncMessage(`Loaded database patients ${result.total === 0 ? 0 : result.skip + 1}-${Math.min(result.skip + result.items.length, result.total)} of ${result.total}.`);
        })
        .catch((error) => {
          if (cancelled) return;
          setPatientRows([]);
          setTotalPatients(0);
          setPatientLoadError(error instanceof Error ? error.message : "Patient page could not be loaded.");
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPatients(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isLoadingWorkflow, page, query, reloadKey, selectedWorkplaceId, workflowError]);

  const patientInActiveWorkspace = useCallback((patient: Patient) => {
    if (isUuid(selectedWorkplaceId) && patient.workplaceIds?.length) return patient.workplaceIds.includes(selectedWorkplaceId);
    if (patient.workContexts?.length) return patient.workContexts.includes(workContext);
    return true;
  }, [selectedWorkplaceId, workContext]);

  const filtered = useMemo(() => {
    return patientRows.filter((p) => {
      if (!patientInActiveWorkspace(p)) return false;
      const matchesTag = !tagFilter || p.tags?.includes(tagFilter as any);
      return matchesTag;
    });
  }, [patientInActiveWorkspace, patientRows, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(totalPatients / PAGE_SIZE));
  const pageStart = totalPatients === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, totalPatients);
  const contextRows = patientRows.filter(patientInActiveWorkspace);
  const allTags = Array.from(new Set(contextRows.flatMap((p) => p.tags ?? [])));

  if (isLoadingWorkflow || isLoadingPatients) {
    return (
      <div>
        <SectionSkeleton />
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="max-w-sm flex-1">
            <div className="h-10 animate-pulse rounded-md bg-ink-faint/20" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-14 animate-pulse rounded-md bg-ink-faint/20" />
            <div className="h-7 w-20 animate-pulse rounded-md bg-ink-faint/20" />
          </div>
        </div>
        <ListSkeleton rows={7} />
      </div>
    );
  }

  function resetForm() {
    setEditingPatientId(null);
    setForm({
      name: "",
      age: "",
      gender: "Male",
      phone: "",
      bloodGroup: "O+",
      condition: "",
      doctorId: doctorRows[0]?.id ?? "",
    });
  }

  function openRegisterForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(patient: Patient) {
    setEditingPatientId(patient.id);
    setForm({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      phone: patient.phone === "Not added" ? "" : patient.phone,
      bloodGroup: patient.bloodGroup,
      condition: patient.conditions[0] ?? "",
      doctorId: patient.primaryDoctorId,
    });
    setShowForm(true);
  }

  async function savePatient() {
    if (!form.name.trim()) return;
    const initials = form.name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    if (editingPatientId) {
      const existing = patientRows.find((patient) => patient.id === editingPatientId);
      try {
        const backendPatient = await updateBackendPatient(editingPatientId, {
          fullName: form.name,
          gender: form.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER",
          phone: form.phone,
          bloodGroup: form.bloodGroup,
          primaryDoctorId: form.doctorId,
        });
        setPatientRows((prev) => prev.map((patient) => (patient.id === editingPatientId ? { ...backendPatient, primaryDoctorId: form.doctorId, bloodGroup: form.bloodGroup, conditions: form.condition ? [form.condition] : [] } : patient)));
        setSyncMessage("Patient changes synced to backend.");
        setReloadKey((value) => value + 1);
      } catch (error) {
        setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "patient update was not saved."}`);
      }
      resetForm();
      setShowForm(false);
      return;
    }

    const nextPatient: Patient = {
      id: `local-pat-${Date.now()}`,
      mrn: `MRN-${10230 + patientRows.length + 1}`,
      name: form.name,
      age: Number(form.age) || 0,
      gender: form.gender,
      phone: form.phone || "Not added",
      avatarInitials: initials || "PT",
      primaryDoctorId: form.doctorId,
      clinicId: workContext === "clinic" ? "clinic-1" : undefined,
      workContexts: [workContext],
      bloodGroup: form.bloodGroup,
      allergies: [],
      conditions: form.condition ? [form.condition] : [],
      lastVisit: "New registration",
      tags: ["New"],
    };
    try {
      await createBackendPatient({
        qlynoId: `QLYNO-${Date.now()}`,
        fullName: form.name,
        gender: form.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER",
        dateOfBirth: birthDateFromAge(Number(form.age)),
        phone: form.phone,
        bloodGroup: form.bloodGroup,
        primaryDoctorId: form.doctorId,
        workplaceId: selectedWorkplaceId,
        localMrn: nextPatient.mrn,
      });
      setPage(0);
      setReloadKey((value) => value + 1);
      setSyncMessage("Patient registration synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "patient registration was not saved."}`);
      return;
    }
    resetForm();
    setShowForm(false);
  }

  async function deletePatient(id: string) {
    if (!window.confirm("Delete this patient record and linked clinical data?")) return;

    try {
      await deleteBackendPatient(id);
      setSyncMessage("Patient deleted from backend.");
    } catch (error) {
      setSyncMessage(`Backend delete failed: ${error instanceof Error ? error.message : "patient was not deleted."}`);
      return;
    }
    if (filtered.length === 1 && page > 0) setPage((value) => Math.max(0, value - 1));
    setReloadKey((value) => value + 1);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="02 - My Patients"
        title="My Patients"
        description={`Centralized list of your assigned ${workContext} patients, medical history and ongoing treatments.`}
        action={
          <button onClick={openRegisterForm} className="btn-primary">
            <Plus size={14} /> Add Patient
          </button>
        }
      />

      <Modal
        open={showForm}
        title={editingPatientId ? "Edit Patient" : "Register Patient"}
        eyebrow="My Patients"
        onClose={() => {
          resetForm();
          setShowForm(false);
        }}
        footer={
          <>
            <button onClick={savePatient} className="btn-primary">
              {editingPatientId ? "Save Changes" : "Register Patient"}
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </>
        }
      >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full Name" className="sm:col-span-2">
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Full name"
              className="input-field"
            />
            </Field>
            <Field label="Age">
            <input
              value={form.age}
              onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
              placeholder="Age"
              type="number"
              className="input-field"
            />
            </Field>
            <Field label="Gender">
            <select
              value={form.gender}
              onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as Patient["gender"] }))}
              className="input-field"
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            </Field>
            <Field label="Phone">
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Phone"
              className="input-field"
            />
            </Field>
            <Field label="Blood Group">
            <input
              value={form.bloodGroup}
              onChange={(event) => setForm((prev) => ({ ...prev, bloodGroup: event.target.value }))}
              placeholder="Blood group"
              className="input-field"
            />
            </Field>
            <Field label="Primary Condition">
            <input
              value={form.condition}
              onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))}
              placeholder="Primary condition"
              className="input-field"
            />
            </Field>
            <Field label="Primary Doctor">
            <select
              value={form.doctorId}
              onChange={(event) => setForm((prev) => ({ ...prev, doctorId: event.target.value }))}
              className="input-field"
            >
              {doctorRows.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            </Field>
          </div>
      </Modal>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or MRN…"
            className="input-field pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter(null)}
            className={`badge border ${!tagFilter ? "bg-brand-500 text-white border-brand-500" : "border-line text-ink-muted"}`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
              className={`badge border ${tagFilter === tag ? "bg-brand-500 text-white border-brand-500" : "border-line text-ink-muted"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      {workflowError || patientLoadError ? (
        <p className="mb-3 rounded-md border border-alert-200 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-600">
          Database sync failed: {workflowError || patientLoadError}
        </p>
      ) : syncMessage ? (
        <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>
      ) : null}

      <Card padded={false}>
        {filtered.length === 0 ? (
          <EmptyState
            title={workflowError || patientLoadError ? "Database patients could not be loaded" : "No patients match"}
            description={workflowError || patientLoadError ? "Check the backend connection, CORS settings, and doctor workplace access." : "Try a different name, MRN, or clear your filters."}
          />
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((p) => {
              const doctor = doctorRows.find((d) => d.id === p.primaryDoctorId);
              return (
                <Link
                  key={p.id}
                  href={p.id.startsWith("local-") ? "/doctor/patients" : `/doctor/patients/${p.id}`}
                  className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-brand-50/40 transition-colors"
                >
                  <Avatar initials={p.avatarInitials} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-ink">{p.name}</p>
                      <span className="font-mono text-[11px] text-ink-faint">{p.mrn}</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {p.age} yrs · {p.gender} · {p.conditions.join(", ") || "No active conditions"}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{doctor?.name ?? "Unassigned doctor"}</p>
                  </div>
                  <div className="hidden md:flex flex-wrap gap-1 max-w-[220px] justify-end">
                    {p.tags?.map((t) => (
                      <Pill key={t} tone={tagTone[t]}>
                        {t}
                      </Pill>
                    ))}
                  </div>
                  <p className="hidden lg:block text-xs text-ink-muted w-28 text-right shrink-0">
                    Last visit {p.lastVisit}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        openEditForm(p);
                      }}
                      className="btn-ghost text-xs"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        deletePatient(p.id);
                      }}
                      className="btn-ghost text-xs text-alert-500"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                    <ChevronRight size={16} className="text-ink-faint" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {pageStart}-{pageEnd} of {totalPatients} database patients
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0}
              className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="font-mono text-[11px] text-ink-muted">
              Page {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
