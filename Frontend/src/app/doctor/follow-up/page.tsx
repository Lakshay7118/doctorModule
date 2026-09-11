"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, CalendarClock } from "lucide-react";
import { SectionHeading, Card, Avatar, Pill, EmptyState, Modal, ListSkeleton, SectionSkeleton } from "@/components/ui";
import { matchesWorkContext, patientInWorkContext } from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { FollowUp, Patient } from "@/lib/types";
import { createBackendFollowUp, getBackendBootstrap, updateBackendFollowUpStatus } from "@/lib/api-client";

const statusTone: Record<FollowUp["status"], "brand" | "clay" | "alert" | "sage"> = {
  Upcoming: "brand",
  "Due Today": "clay",
  Overdue: "alert",
  Completed: "sage",
};

export default function FollowUpPage() {
  const { selectedWorkplaceId, workContext } = useMode();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const contextPatients = useMemo(
    () => patients.filter((patient) => patientInWorkContext(patient, workContext)),
    [patients, workContext]
  );
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);

  useEffect(() => {
    let cancelled = false;

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        setPatients(data.patients);
        setFollowUps(data.followUps);
        setBackendDoctorId(data.currentDoctorId ?? data.doctors[0]?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
        setFollowUps([]);
        setBackendDoctorId("");
        setSyncMessage("Unable to load follow-ups from the backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFollowUps(false);
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

  async function schedule() {
    if (!dueDate || !reason.trim()) return;
    let nextFollowUp: FollowUp = { id: `fu-${Date.now()}`, patientId, doctorId: backendDoctorId, dueDate, reason, status: "Upcoming", workContext };
    try {
      nextFollowUp = {
        ...(await createBackendFollowUp({
        patientId,
        doctorId: backendDoctorId,
        workplaceId: selectedWorkplaceId,
        dueDate,
        reason,
        })),
        workContext,
      };
      setSyncMessage("Follow-up synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "follow-up was not saved."}`);
      return;
    }
    setFollowUps((prev) => [nextFollowUp, ...prev]);
    setDueDate("");
    setReason("");
    setShowForm(false);
  }

  async function markComplete(id: string) {
    try {
      const followUp = followUps.find((item) => item.id === id);
      await updateBackendFollowUpStatus(id, "Completed", followUp?.workplaceId);
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, status: "Completed" } : f)));
      setSyncMessage("Follow-up status synced to backend.");
    } catch (error) {
      setSyncMessage(`Backend sync failed: ${error instanceof Error ? error.message : "follow-up status was not updated."}`);
    }
  }

  const groups: FollowUp["status"][] = ["Overdue", "Due Today", "Upcoming", "Completed"];

  if (isLoadingFollowUps) {
    return (
      <div>
        <SectionSkeleton />
        <div className="space-y-6">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        eyebrow="11 - Follow-up Management"
        title="Follow-up Management"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Schedule Follow-up
          </button>
        }
        description={`Schedule future ${workContext} consultations, monitor follow-up visits, and maintain continuity of patient care.`}
      />

      <Modal
        open={showForm}
        title="Schedule a Follow-up"
        eyebrow="Follow-up Management"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={schedule} className="btn-primary">
              <Plus size={14} /> Schedule Follow-up
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
            <label className="text-[11px] text-ink-muted block mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-ink-muted block mb-1">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Review lab results"
              className="input-field"
            />
          </div>
        </div>
      </Modal>
      {syncMessage && <p className="mb-3 text-xs text-ink-muted">{syncMessage}</p>}

      <div className="space-y-6">
        {groups.map((status) => {
          const items = followUps.filter((f) => matchesWorkContext(f, workContext) && f.status === status);
          if (items.length === 0) return null;
          return (
            <div key={status}>
              <p className="text-xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
                <CalendarClock size={12} /> {status} ({items.length})
              </p>
              <Card padded={false}>
                <div className="divide-y divide-line">
                  {items.map((f) => {
                    const patient = patientById.get(f.patientId);
                    if (!patient) return null;
                    return (
                      <div key={f.id} className="flex items-center gap-3.5 px-5 py-3.5">
                        <Avatar initials={patient.avatarInitials} size={32} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/doctor/patients/${patient.id}`} className="text-[13px] font-medium text-ink hover:text-brand-700">
                            {patient.name}
                          </Link>
                          <p className="text-xs text-ink-muted">{f.reason}</p>
                        </div>
                        <span className="font-mono text-xs text-ink-muted">{f.dueDate}</span>
                        <Pill tone={statusTone[f.status]}>{f.status}</Pill>
                        {f.status !== "Completed" && (
                          <button onClick={() => markComplete(f.id)} className="btn-ghost text-xs">
                            Mark Done
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })}
        {followUps.filter((f) => matchesWorkContext(f, workContext)).length === 0 && (
          <EmptyState title="No follow-ups scheduled" />
        )}
      </div>
    </div>
  );
}
