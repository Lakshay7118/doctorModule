"use client";

import * as React from "react";
import {
  ApiSyncSkippedError,
  createBackendAppointment,
  createBackendPatient,
  getBackendBootstrap,
  getBackendState,
  isUuid,
  saveBackendState,
  updateBackendAppointmentStatus,
} from "@/lib/api-client";
import { Card, SectionSkeleton, Skeleton } from "@/components/ui";
import type {
  Appointment as DoctorAppointment,
  AppointmentStatus as DoctorAppointmentStatus,
  Doctor,
  Patient as DoctorPatient,
} from "@/lib/types";
import {
  Patient,
  Appointment,
  QueueEntry,
  Visitor,
  Admission,
  ReceptionistDoctor,
  initialPatients,
  initialAppointments,
  initialQueue,
  initialVisitors,
  initialAdmissions,
  doctors as seededDoctors,
  generateUHID,
  generateToken,
} from "./mock-data";
import { formatReceptionistDate, parseReceptionistDate } from "./date-utils";

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  channel: "SMS" | "Email" | "System" | "Call";
}

interface ReceptionistData {
  doctors: ReceptionistDoctor[];
  patients: Patient[];
  appointments: Appointment[];
  queue: QueueEntry[];
  visitors: Visitor[];
  admissions: Admission[];
  notifications: NotificationItem[];
  addPatient: (p: Omit<Patient, "uhid">) => Patient;
  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  updateAppointmentStatus: (id: string, status: Appointment["status"]) => void;
  checkIn: (q: Omit<QueueEntry, "token">) => QueueEntry;
  advanceQueueStatus: (token: string, status: QueueEntry["status"]) => void;
  addVisitor: (v: Omit<Visitor, "id" | "passIssued" | "status">) => Visitor;
  checkOutVisitor: (id: string) => void;
  addAdmission: (a: Omit<Admission, "id">) => Admission;
  pushNotification: (n: Omit<NotificationItem, "id" | "time">) => void;
}

const ReceptionistDataContext = React.createContext<ReceptionistData | null>(null);

const STATE_SCOPE = "receptionist-workspace";
const STATE_ENTITY_ID = "front-desk";

interface PersistedReceptionistState {
  queue?: QueueEntry[];
  visitors?: Visitor[];
  admissions?: Admission[];
  notifications?: NotificationItem[];
}

function backendGender(gender: Patient["gender"]) {
  if (gender === "Female") return "FEMALE" as const;
  if (gender === "Male") return "MALE" as const;
  return "OTHER" as const;
}

function isoToDisplayDate(value: string) {
  return formatReceptionistDate(value);
}

function birthDateFromAge(age: number) {
  if (!Number.isFinite(age) || age <= 0) return undefined;
  const today = new Date();
  return `${today.getFullYear() - Math.floor(age)}-01-01`;
}

function receptionistStatus(status: DoctorAppointment["status"]): Appointment["status"] {
  if (status === "Completed") return "Completed";
  if (status === "Cancelled" || status === "No Show") return "Cancelled";
  return "Confirmed";
}

function backendAppointmentStatus(status: Appointment["status"]): DoctorAppointmentStatus {
  if (status === "Completed") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  return "Scheduled";
}

function queueAppointmentStatus(status: QueueEntry["status"]): DoctorAppointmentStatus {
  if (status === "In Consultation") return "In Consultation";
  if (status === "Completed") return "Completed";
  return "Checked In";
}

function ignoreSyncError(error: unknown) {
  if (error instanceof ApiSyncSkippedError) return;
  console.warn("Receptionist backend sync failed", error);
}

function ReceptionistWorkspaceSkeleton() {
  return (
    <div>
      <SectionSkeleton />
      <Card className="mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <Card key={cardIndex}>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-14" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-44 max-w-full" />
                    <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ReceptionistDataProvider({ children }: { children: React.ReactNode }) {
  const hydratedRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [doctors, setDoctors] = React.useState<ReceptionistDoctor[]>(seededDoctors);
  const [backendDoctorRows, setBackendDoctorRows] = React.useState<Doctor[]>([]);
  const [backendWorkplaceId, setBackendWorkplaceId] = React.useState<string | undefined>();
  const [patients, setPatients] = React.useState<Patient[]>(initialPatients);
  const [appointments, setAppointments] = React.useState<Appointment[]>(initialAppointments);
  const [queue, setQueue] = React.useState<QueueEntry[]>(initialQueue);
  const [visitors, setVisitors] = React.useState<Visitor[]>(initialVisitors);
  const [admissions, setAdmissions] = React.useState<Admission[]>(initialAdmissions);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([
    { id: "N-1", title: "Appointment confirmed", detail: "Sent to Ramesh Chandra Verma for 11:30 AM with Dr. Sanjay Kapoor", time: "9:02 AM", channel: "SMS" },
    { id: "N-2", title: "Bed allotted", detail: "ICU-04 assigned for Ramesh Chandra Verma", time: "Yesterday", channel: "System" },
  ]);

  function mapBackendDoctors(rows: Doctor[]): ReceptionistDoctor[] {
    return rows.map((doctor) => ({
      name: doctor.name,
      department: doctor.specialty,
      backendId: doctor.id,
    }));
  }

  function mapBackendPatients(rows: DoctorPatient[], doctorRows: ReceptionistDoctor[], workplaceId?: string): Patient[] {
    return rows.map((patient) => {
      const primaryDoctor = doctorRows.find((doctor) => doctor.backendId === patient.primaryDoctorId);
      return {
        uhid: patient.mrn,
        backendId: patient.id,
        primaryDoctorId: patient.primaryDoctorId,
        workplaceId: patient.clinicId ?? workplaceId,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        department: primaryDoctor?.department ?? patient.conditions[0] ?? "General Medicine",
        bloodGroup: patient.bloodGroup === "-" ? undefined : patient.bloodGroup,
        lastVisit: patient.lastVisit === "Backend" ? "Synced" : patient.lastVisit,
        status: patient.tags?.includes("New") ? "New" : "Active",
      };
    });
  }

  function mapBackendAppointments(
    rows: DoctorAppointment[],
    patientRows: Patient[],
    doctorRows: ReceptionistDoctor[],
    workplaceId?: string
  ): Appointment[] {
    return rows.map((appointment) => {
      const patient = patientRows.find((item) => item.backendId === appointment.patientId);
      const doctor = doctorRows.find((item) => item.backendId === appointment.doctorId);
      return {
        id: appointment.id,
        backendId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        workplaceId: patient?.workplaceId ?? workplaceId,
        patient: patient?.name ?? "Unknown patient",
        uhid: patient?.uhid ?? appointment.patientId.slice(0, 8),
        doctor: doctor?.name ?? "Assigned doctor",
        department: doctor?.department ?? patient?.department ?? "General Medicine",
        date: isoToDisplayDate(appointment.date),
        time: appointment.time,
        status: receptionistStatus(appointment.status),
      };
    });
  }

  async function refreshBackendCore() {
    const data = await getBackendBootstrap({ ensureDemo: true });
    const doctorRows = mapBackendDoctors(data.doctors);
    const nextDoctors = doctorRows.length > 0 ? doctorRows : seededDoctors;
    const nextPatients = mapBackendPatients(data.patients, nextDoctors, data.workplaceId);
    const nextAppointments = mapBackendAppointments(data.appointments, nextPatients, nextDoctors, data.workplaceId);

    setBackendDoctorRows(data.doctors);
    setBackendWorkplaceId(data.workplaceId);
    setDoctors(nextDoctors);
    if (nextPatients.length > 0) setPatients(nextPatients);
    setAppointments(nextAppointments);
  }

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getBackendBootstrap({ ensureDemo: true });
        if (cancelled) return;

        const doctorRows = mapBackendDoctors(data.doctors);
        const nextDoctors = doctorRows.length > 0 ? doctorRows : seededDoctors;
        const nextPatients = mapBackendPatients(data.patients, nextDoctors, data.workplaceId);
        const nextAppointments = mapBackendAppointments(data.appointments, nextPatients, nextDoctors, data.workplaceId);

        setBackendDoctorRows(data.doctors);
        setBackendWorkplaceId(data.workplaceId);
        setDoctors(nextDoctors);
        if (nextPatients.length > 0) setPatients(nextPatients);
        setAppointments(nextAppointments);
      } catch (error) {
        ignoreSyncError(error);
      }

      try {
        const state = await getBackendState<PersistedReceptionistState>(STATE_SCOPE, STATE_ENTITY_ID);
        if (cancelled || !state) return;
        if (Array.isArray(state.queue)) setQueue(state.queue);
        if (Array.isArray(state.visitors)) setVisitors(state.visitors);
        if (Array.isArray(state.admissions)) setAdmissions(state.admissions);
        if (Array.isArray(state.notifications)) setNotifications(state.notifications);
      } catch (error) {
        ignoreSyncError(error);
      } finally {
        hydratedRef.current = true;
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;

    const timeout = window.setTimeout(() => {
      void saveBackendState(STATE_SCOPE, STATE_ENTITY_ID, {
        queue,
        visitors,
        admissions,
        notifications,
      } satisfies PersistedReceptionistState).catch(ignoreSyncError);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [admissions, notifications, queue, visitors]);

  const nowTime = () =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  function findBackendDoctorForDepartment(department: string) {
    return backendDoctorRows.find((doctor) => doctor.specialty === department) ?? backendDoctorRows[0];
  }

  function findDoctorOption(name: string) {
    return doctors.find((doctor) => doctor.name === name);
  }

  const addPatient: ReceptionistData["addPatient"] = (p) => {
    const doctor = findBackendDoctorForDepartment(p.department);
    const patient: Patient = {
      ...p,
      uhid: generateUHID(patients),
      primaryDoctorId: doctor?.id,
      workplaceId: backendWorkplaceId,
    };
    setPatients((prev) => [patient, ...prev]);
    pushNotification({
      title: "Patient registered",
      detail: `${patient.name} registered with ${patient.uhid}`,
      channel: "System",
    });

    void createBackendPatient({
      qlynoId: patient.uhid,
      fullName: patient.name,
      gender: backendGender(patient.gender),
      dateOfBirth: birthDateFromAge(patient.age),
      phone: patient.phone,
      bloodGroup: patient.bloodGroup,
      primaryDoctorId: doctor?.id,
      workplaceId: backendWorkplaceId,
      localMrn: patient.uhid,
    })
      .then(() => refreshBackendCore())
      .catch(ignoreSyncError);

    return patient;
  };

  const addAppointment: ReceptionistData["addAppointment"] = (a) => {
    const patient = patients.find((item) => item.uhid === a.uhid);
    const doctor = findDoctorOption(a.doctor);
    const appt: Appointment = {
      ...a,
      date: formatReceptionistDate(a.date),
      id: `APT-${1043 + appointments.length}`,
      patientId: patient?.backendId,
      doctorId: doctor?.backendId,
      workplaceId: patient?.workplaceId ?? backendWorkplaceId,
    };
    setAppointments((prev) => [appt, ...prev]);
    pushNotification({
      title: "Appointment booked",
      detail: `${appt.patient} scheduled with ${appt.doctor} on ${appt.date}, ${appt.time}`,
      channel: "SMS",
    });

    const patientId = patient?.backendId;
    const doctorId = doctor?.backendId;
    const workplaceId = appt.workplaceId;
    if (isUuid(patientId) && isUuid(doctorId) && isUuid(workplaceId)) {
      void createBackendAppointment({
        patientId,
        doctorId,
        workplaceId,
        date: parseReceptionistDate(appt.date),
        time: appt.time,
        durationMins: 20,
        type: "In-Person",
        reason: "Front desk booking",
      })
        .then(() => refreshBackendCore())
        .catch(ignoreSyncError);
    }

    return appt;
  };

  const updateAppointmentStatus: ReceptionistData["updateAppointmentStatus"] = (id, status) => {
    const appointment = appointments.find((item) => item.id === id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const appointmentId = appointment?.backendId;
    if (isUuid(appointmentId)) {
      void updateBackendAppointmentStatus(appointmentId, backendAppointmentStatus(status)).catch(ignoreSyncError);
    }
  };

  const checkIn: ReceptionistData["checkIn"] = (q) => {
    const patient = patients.find((item) => item.name === q.patient);
    const doctor = findDoctorOption(q.doctor);
    const matchingAppointment = appointments.find(
      (appointment) =>
        appointment.uhid === patient?.uhid &&
        appointment.doctor === q.doctor &&
        appointment.status !== "Cancelled" &&
        appointment.status !== "Completed"
    );
    const entry: QueueEntry = {
      ...q,
      token: generateToken(queue),
      appointmentId: matchingAppointment?.backendId,
      patientId: patient?.backendId,
      doctorId: doctor?.backendId,
      workplaceId: patient?.workplaceId ?? backendWorkplaceId,
    };
    setQueue((prev) => [entry, ...prev]);
    pushNotification({
      title: "Patient checked in",
      detail: `${entry.patient} issued token ${entry.token} for ${entry.doctor}`,
      channel: "System",
    });
    const appointmentId = matchingAppointment?.backendId;
    if (isUuid(appointmentId)) {
      void updateBackendAppointmentStatus(appointmentId, "Checked In").catch(ignoreSyncError);
    }
    return entry;
  };

  const advanceQueueStatus: ReceptionistData["advanceQueueStatus"] = (token, status) => {
    const entry = queue.find((item) => item.token === token);
    setQueue((prev) => prev.map((q) => (q.token === token ? { ...q, status } : q)));
    const appointmentId = entry?.appointmentId;
    if (isUuid(appointmentId)) {
      void updateBackendAppointmentStatus(appointmentId, queueAppointmentStatus(status)).catch(ignoreSyncError);
    }
  };

  const addVisitor: ReceptionistData["addVisitor"] = (v) => {
    const visitor: Visitor = {
      ...v,
      id: `VIS-${3302 + visitors.length}`,
      passIssued: nowTime(),
      status: "Checked In",
    };
    setVisitors((prev) => [visitor, ...prev]);
    return visitor;
  };

  const checkOutVisitor: ReceptionistData["checkOutVisitor"] = (id) => {
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Checked Out" } : v)));
  };

  const addAdmission: ReceptionistData["addAdmission"] = (a) => {
    const admission: Admission = { ...a, id: `IPD-${2232 + admissions.length}` };
    setAdmissions((prev) => [admission, ...prev]);
    pushNotification({
      title: "Patient admitted",
      detail: `${admission.patient} admitted to ${admission.ward} (${admission.bed})`,
      channel: "System",
    });
    return admission;
  };

  const pushNotification: ReceptionistData["pushNotification"] = (n) => {
    setNotifications((prev) => [
      { ...n, id: `N-${prev.length + 1}`, time: "Just now" },
      ...prev,
    ]);
  };

  const value: ReceptionistData = {
    doctors,
    patients,
    appointments,
    queue,
    visitors,
    admissions,
    notifications,
    addPatient,
    addAppointment,
    updateAppointmentStatus,
    checkIn,
    advanceQueueStatus,
    addVisitor,
    checkOutVisitor,
    addAdmission,
    pushNotification,
  };

  if (isLoading) return <ReceptionistWorkspaceSkeleton />;

  return (
    <ReceptionistDataContext.Provider value={value}>
      {children}
    </ReceptionistDataContext.Provider>
  );
}

export function useReceptionistData() {
  const ctx = React.useContext(ReceptionistDataContext);
  if (!ctx) {
    throw new Error("useReceptionistData must be used within ReceptionistDataProvider");
  }
  return ctx;
}
