"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FilePlus2,
  FileWarning,
  FlaskConical,
  ListTodo,
  Radio,
  Search,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import {
  appointments as seedAppointments,
  clinicalAlerts as seedAlerts,
  diagnoses as seedDiagnoses,
  followUps as seedFollowUps,
  labOrders as seedLabOrders,
  matchesWorkContext,
  patients as seedPatients,
  patientInWorkContext,
  prescriptions as seedPrescriptions,
  radiologyOrders as seedRadiologyOrders,
} from "@/lib/mock-data";
import { useMode } from "@/lib/mode-context";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";

type ResultKind =
  | "patient"
  | "appointment"
  | "task"
  | "queue"
  | "diagnosis"
  | "prescription"
  | "lab"
  | "radiology"
  | "followUp"
  | "alert";

type SearchCategory = "all" | "patients" | "appointments" | "tasks" | "orders" | "clinical" | "alerts";

interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const resultCategories: Array<{ id: SearchCategory; label: string; kinds: ResultKind[] }> = [
  { id: "all", label: "All", kinds: [] },
  { id: "patients", label: "Patients", kinds: ["patient"] },
  { id: "appointments", label: "Appointments", kinds: ["appointment", "queue"] },
  { id: "tasks", label: "Tasks", kinds: ["task"] },
  { id: "orders", label: "Orders", kinds: ["prescription", "lab", "radiology"] },
  { id: "clinical", label: "Clinical", kinds: ["diagnosis", "followUp"] },
  { id: "alerts", label: "Alerts", kinds: ["alert"] },
];

const kindLabels: Record<ResultKind, string> = {
  patient: "Patient",
  appointment: "Appointment",
  task: "Task",
  queue: "Queue",
  diagnosis: "Diagnosis",
  prescription: "Prescription",
  lab: "Lab",
  radiology: "Radiology",
  followUp: "Follow-up",
  alert: "Alert",
};

function categoryForKind(kind: ResultKind): SearchCategory {
  return resultCategories.find((category) => category.id !== "all" && category.kinds.includes(kind))?.id ?? "all";
}

function matchesQuery(query: string, values: Array<string | number | undefined | null>) {
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { workContext } = useMode();
  const {
    alerts,
    appointments,
    clinicQueue,
    diagnoses,
    doctorTasks,
    followUps,
    labOrders,
    patients,
    prescriptions,
    radiologyOrders,
  } = useDoctorWorkflow();

  const results: Result[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];
    const patientRows = patients.length > 0 ? patients : seedPatients;
    const appointmentRows = appointments.length > 0 ? appointments : seedAppointments;
    const diagnosisRows = diagnoses.length > 0 ? diagnoses : seedDiagnoses;
    const prescriptionRows = prescriptions.length > 0 ? prescriptions : seedPrescriptions;
    const labRows = labOrders.length > 0 ? labOrders : seedLabOrders;
    const radiologyRows = radiologyOrders.length > 0 ? radiologyOrders : seedRadiologyOrders;
    const followUpRows = followUps.length > 0 ? followUps : seedFollowUps;
    const alertRows = alerts.length > 0 ? alerts : seedAlerts;
    const patientById = new Map(patientRows.map((patient) => [patient.id, patient]));

    patientRows
      .filter(
        (patient) =>
          patientInWorkContext(patient, workContext) &&
          matchesQuery(q, [
            patient.name,
            patient.mrn,
            patient.phone,
            patient.bloodGroup,
            patient.age,
            patient.gender,
            ...patient.conditions,
            ...(patient.tags ?? []),
          ])
      )
      .slice(0, 5)
      .forEach((patient) =>
        out.push({
          kind: "patient",
          id: patient.id,
          title: patient.name,
          subtitle: `${patient.mrn} - ${patient.age} / ${patient.gender}`,
          href: `/doctor/patients/${patient.id}`,
        })
      );

    appointmentRows
      .filter((appointment) => {
        const patient = patientById.get(appointment.patientId);
        return (
          matchesWorkContext(appointment, workContext) &&
          matchesQuery(q, [
            appointment.id,
            appointment.reason,
            appointment.status,
            appointment.type,
            appointment.date,
            appointment.time,
            patient?.name,
            patient?.mrn,
            patient?.phone,
          ])
        );
      })
      .slice(0, 5)
      .forEach((appointment) => {
        const patient = patientById.get(appointment.patientId);
        out.push({
          kind: "appointment",
          id: appointment.id,
          title: appointment.reason,
          subtitle: `${patient?.name ?? "Unknown"} - ${appointment.date} ${appointment.time} - ${appointment.status}`,
          href: `/doctor/consultation?patient=${appointment.patientId}&appointment=${appointment.id}`,
        });
      });

    doctorTasks
      .filter((task) => {
        const patient = task.patientId ? patientById.get(task.patientId) : undefined;
        return matchesQuery(q, [
          task.id,
          task.title,
          task.status,
          task.priority,
          task.source,
          task.assignedBy,
          task.dueTime,
          patient?.name,
          patient?.mrn,
        ]);
      })
      .slice(0, 5)
      .forEach((task) => {
        const patient = task.patientId ? patientById.get(task.patientId) : undefined;
        out.push({
          kind: "task",
          id: task.id,
          title: task.title,
          subtitle: `${patient?.name ?? task.source} - ${task.priority} - ${task.status}`,
          href: task.appointmentId && task.patientId
            ? `/doctor/consultation?patient=${task.patientId}&appointment=${task.appointmentId}`
            : "/doctor/tasks",
        });
      });

    clinicQueue
      .filter((item) => {
        const patient = patientById.get(item.patientId);
        return matchesQuery(q, [
          item.id,
          item.token,
          item.reason,
          item.status,
          item.appointmentTime,
          patient?.name,
          patient?.mrn,
          patient?.phone,
        ]);
      })
      .slice(0, 3)
      .forEach((item) => {
        const patient = patientById.get(item.patientId);
        out.push({
          kind: "queue",
          id: item.id,
          title: `Token #${item.token} - ${patient?.name ?? "Patient"}`,
          subtitle: `${item.reason} - ${item.status.replace("_", " ")}`,
          href: `/doctor/consultation?patient=${item.patientId}&appointment=${item.id}`,
        });
      });

    diagnosisRows
      .filter((diagnosis) => {
        const patient = patientById.get(diagnosis.patientId);
        return (
          matchesWorkContext(diagnosis, workContext) &&
          matchesQuery(q, [diagnosis.icdCode, diagnosis.description, diagnosis.status, patient?.name, patient?.mrn])
        );
      })
      .slice(0, 3)
      .forEach((diagnosis) => {
        const patient = patientById.get(diagnosis.patientId);
        out.push({
          kind: "diagnosis",
          id: diagnosis.id,
          title: diagnosis.description,
          subtitle: `${patient?.name ?? "Unknown"} - ${diagnosis.icdCode} - ${diagnosis.status}`,
          href: `/doctor/diagnosis`,
        });
      });

    prescriptionRows
      .filter((rx) => {
        const patient = patientById.get(rx.patientId);
        return (
          Boolean(patient && patientInWorkContext(patient, workContext)) &&
          matchesQuery(q, [
            rx.id,
            rx.date,
            rx.status,
            rx.advice,
            patient?.name,
            patient?.mrn,
            ...rx.medicines.flatMap((medicine) => [medicine.name, medicine.dosage, medicine.frequency, medicine.duration]),
          ])
        );
      })
      .slice(0, 3)
      .forEach((rx) => {
        const patient = patientById.get(rx.patientId);
        out.push({
          kind: "prescription",
          id: rx.id,
          title: `Rx for ${patient?.name ?? "Unknown"}`,
          subtitle: rx.medicines.map((m) => m.name).join(", "),
          href: `/doctor/prescriptions?patient=${rx.patientId}`,
        });
      });

    labRows
      .filter((lab) => {
        const patient = patientById.get(lab.patientId);
        return (
          matchesWorkContext(lab, workContext) &&
          matchesQuery(q, [
            lab.id,
            lab.testName,
            lab.status,
            lab.priority,
            lab.source,
            lab.report?.resultSummary,
            lab.report?.interpretation,
            patient?.name,
            patient?.mrn,
          ])
        );
      })
      .slice(0, 3)
      .forEach((lab) => {
        const patient = patientById.get(lab.patientId);
        out.push({
          kind: "lab",
          id: lab.id,
          title: lab.testName,
          subtitle: `${patient?.name ?? "Unknown"} - ${lab.status}`,
          href: `/doctor/lab-orders?patient=${lab.patientId}`,
        });
      });

    radiologyRows
      .filter((order) => {
        const patient = patientById.get(order.patientId);
        return (
          matchesWorkContext(order, workContext) &&
          matchesQuery(q, [order.id, order.imagingType, order.bodyRegion, order.status, order.priority, patient?.name, patient?.mrn])
        );
      })
      .slice(0, 3)
      .forEach((order) => {
        const patient = patientById.get(order.patientId);
        out.push({
          kind: "radiology",
          id: order.id,
          title: `${order.imagingType} - ${order.bodyRegion}`,
          subtitle: `${patient?.name ?? "Unknown"} - ${order.status}`,
          href: `/doctor/radiology-orders?patient=${order.patientId}`,
        });
      });

    followUpRows
      .filter((followUp) => {
        const patient = patientById.get(followUp.patientId);
        return (
          matchesWorkContext(followUp, workContext) &&
          matchesQuery(q, [followUp.id, followUp.reason, followUp.status, followUp.dueDate, patient?.name, patient?.mrn])
        );
      })
      .slice(0, 3)
      .forEach((followUp) => {
        const patient = patientById.get(followUp.patientId);
        out.push({
          kind: "followUp",
          id: followUp.id,
          title: followUp.reason,
          subtitle: `${patient?.name ?? "Unknown"} - ${followUp.dueDate} - ${followUp.status}`,
          href: `/doctor/follow-up`,
        });
      });

    alertRows
      .filter((alert) => {
        const patient = alert.patientId ? patientById.get(alert.patientId) : undefined;
        return (
          matchesWorkContext(alert, workContext) &&
          matchesQuery(q, [alert.id, alert.category, alert.severity, alert.message, alert.time, patient?.name, patient?.mrn])
        );
      })
      .slice(0, 3)
      .forEach((alert) => {
        const patient = alert.patientId ? patientById.get(alert.patientId) : undefined;
        out.push({
          kind: "alert",
          id: alert.id,
          title: patient?.name ?? alert.category,
          subtitle: `${alert.severity} - ${alert.message}`,
          href: `/doctor/alerts`,
        });
      });

    return out;
  }, [
    alerts,
    appointments,
    clinicQueue,
    diagnoses,
    doctorTasks,
    followUps,
    labOrders,
    patients,
    prescriptions,
    query,
    radiologyOrders,
    workContext,
  ]);

  const icons: Record<ResultKind, typeof User> = {
    patient: User,
    appointment: CalendarDays,
    task: ListTodo,
    queue: Stethoscope,
    diagnosis: FileWarning,
    prescription: FilePlus2,
    lab: FlaskConical,
    radiology: Radio,
    followUp: ClipboardList,
    alert: Activity,
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<SearchCategory, number> = {
      all: results.length,
      patients: 0,
      appointments: 0,
      tasks: 0,
      orders: 0,
      clinical: 0,
      alerts: 0,
    };

    results.forEach((result) => {
      counts[categoryForKind(result.kind)] += 1;
    });

    return counts;
  }, [results]);

  const filteredResults = useMemo(() => {
    if (activeCategory === "all") return results;
    const category = resultCategories.find((item) => item.id === activeCategory);
    return category ? results.filter((result) => category.kinds.includes(result.kind)) : results;
  }, [activeCategory, results]);

  const groupedResults = useMemo(
    () =>
      resultCategories
        .filter((category) => category.id !== "all")
        .map((category) => ({
          ...category,
          results: results.filter((result) => category.kinds.includes(result.kind)),
        }))
        .filter((category) => category.results.length > 0),
    [results]
  );

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setActiveCategory("all");
    router.push(href);
  }

  function discover() {
    const next = query.trim() ? `/discover?q=${encodeURIComponent(query.trim())}` : "/discover";
    setOpen(false);
    setQuery("");
    setActiveCategory("all");
    router.push(next);
  }

  function renderResult(result: Result) {
    const Icon = icons[result.kind];
    return (
      <button
        key={`${result.kind}-${result.id}`}
        onClick={() => go(result.href)}
        className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-brand-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-md bg-paper border border-line flex items-center justify-center shrink-0">
          <Icon size={13} className="text-brand-600" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="block truncate text-[13px] font-medium text-ink">{result.title}</span>
            <span className="shrink-0 rounded-sm bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              {kindLabels[result.kind]}
            </span>
          </span>
          <span className="block text-[11px] text-ink-muted truncate">{result.subtitle}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) setActiveCategory("all");
          }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${workContext} patients, appointments, prescriptions, tests...`}
          className="w-full rounded-md border border-line bg-paper pl-9 pr-8 py-2 text-[13px] placeholder:text-ink-faint focus:bg-white focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && query && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-[min(36rem,calc(100vw-2rem))] card p-1.5 max-h-96 overflow-y-auto">
            <div className="mb-1.5 flex gap-1 overflow-x-auto border-b border-line px-1 pb-1.5">
              {resultCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    activeCategory === category.id
                      ? "bg-brand-500 text-white"
                      : "bg-paper text-ink-muted hover:bg-brand-50 hover:text-brand-700"
                  }`}
                >
                  {category.label}
                  <span className={activeCategory === category.id ? "ml-1 text-white/80" : "ml-1 text-ink-faint"}>
                    {categoryCounts[category.id]}
                  </span>
                </button>
              ))}
            </div>
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-ink-muted">No clinical records match &quot;{query}&quot;</p>
                <button onClick={discover} className="btn-secondary text-xs mt-3">
                  Search public care <ArrowUpRight size={13} />
                </button>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-ink-muted">
                  No {resultCategories.find((category) => category.id === activeCategory)?.label.toLowerCase()} match &quot;{query}&quot;
                </p>
                <button onClick={() => setActiveCategory("all")} className="btn-secondary text-xs mt-3">
                  View all categories
                </button>
              </div>
            ) : (
              <>
                {activeCategory === "all"
                  ? groupedResults.map((group) => (
                    <section key={group.id} className="py-1">
                      <div className="flex items-center justify-between px-2.5 py-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{group.label}</p>
                        <span className="text-[10px] font-semibold text-ink-faint">{group.results.length}</span>
                      </div>
                      {group.results.map(renderResult)}
                    </section>
                  ))
                  : filteredResults.map(renderResult)}
                <button
                  onClick={discover}
                  className="w-full flex items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  Search doctors, clinics, labs and medicines
                  <ArrowUpRight size={13} />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
