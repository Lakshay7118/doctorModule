"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  clinicQueue as clinicQueueSeed,
  doctorShifts as doctorShiftsSeed,
  doctorTasks as doctorTasksSeed,
  doctorWorkplaces,
  hospitalWorklist as hospitalWorklistSeed,
} from "./doctor-workflow-data";
import {
  ClinicQueueItem,
  DoctorShift,
  DoctorTaskItem,
  HospitalWorkItem,
  ShiftStatus,
  Workplace,
  workplaceToContext,
} from "./doctor-workflow-types";
import { Appointment, ClinicalAlert, DiagnosisEntry, Doctor, FollowUp, LabOrder, Patient, Prescription, RadiologyOrder, StaffMember } from "./types";
import { useMode } from "./mode-context";
import { getLocalDateISO } from "./app-time";
import {
  completeBackendAdmission,
  getBackendBootstrap,
  sendBackendMessage,
  updateBackendAppointmentStatus,
  updateBackendShiftStatus,
  updateBackendTaskStatus,
} from "./api-client";

interface DoctorWorkflowContextValue {
  isLoadingWorkflow: boolean;
  workflowError?: string;
  workplaces: Workplace[];
  shifts: DoctorShift[];
  clinicQueue: ClinicQueueItem[];
  hospitalWorklist: HospitalWorkItem[];
  doctorTasks: DoctorTaskItem[];
  patients: Patient[];
  doctors: Doctor[];
  staff: StaffMember[];
  appointments: Appointment[];
  diagnoses: DiagnosisEntry[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  radiologyOrders: RadiologyOrder[];
  followUps: FollowUp[];
  alerts: ClinicalAlert[];
  backendDoctorId?: string;
  currentDoctorName: string;
  activeShift?: DoctorShift;
  selectedShift?: DoctorShift;
  selectShift: (id?: string) => void;
  getWorkplace: (id: string) => Workplace | undefined;
  startShift: (id: string) => void;
  completeShift: (id: string) => void;
  addShift: (shift: DoctorShift) => void;
  addPrescription: (prescription: Prescription) => void;
  updateShiftStatus: (id: string, status: ShiftStatus) => void;
  startQueueConsultation: (id: string) => void;
  completeQueueConsultation: (id: string) => void;
  markAppointmentCompleted: (id: string) => void;
  acceptHospitalRequest: (id: string) => void;
  completeHospitalItem: (id: string) => void;
  handoverHospitalItem: (id: string, doctorName: string) => void;
  completeTask: (id: string) => void;
  startTask: (id: string) => void;
}

const DoctorWorkflowContext = createContext<DoctorWorkflowContextValue | null>(null);

function buildClinicQueue(appointments: Appointment[], workplaces: Workplace[], doctorId?: string): ClinicQueueItem[] {
  const eligible = appointments
    .filter((appointment) => appointment.doctorId === doctorId && appointment.status !== "Cancelled" && appointment.status !== "No Show")
    .filter((appointment) => {
      const workplace = workplaces.find((item) => item.id === appointment.workplaceId);
      // Hospital OPD appointments use the same doctor queue as clinic and
      // online appointments. Keep the workplace lookup so orphaned records
      // cannot appear in the queue.
      return Boolean(workplace);
    })
    .sort(compareAppointmentsForActiveList);

  return sortClinicQueue(eligible.map((appointment, index) => ({
    id: appointment.id,
    token: String(index + 1).padStart(2, "0"),
    patientId: appointment.patientId,
    workplaceId: appointment.workplaceId ?? "",
    appointmentTime: appointment.time,
    reason: appointment.reason,
    waitingMins: 0,
    status:
      appointment.status === "In Consultation"
        ? "in_consultation"
        : appointment.status === "Completed"
          ? "completed"
          : appointment.status === "Checked In"
            ? "waiting"
            : "upcoming",
  })));
}

function updateQueueStatus(items: ClinicQueueItem[], id: string, status: ClinicQueueItem["status"]) {
  return sortClinicQueue(items.map((item) => (item.id === id ? { ...item, status } : item)));
}

function compareAppointmentsForActiveList(a: Appointment, b: Appointment) {
  const aCompleted = a.status === "Completed";
  const bCompleted = b.status === "Completed";
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function sortClinicQueue(items: ClinicQueueItem[]) {
  return [...items].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return a.token.localeCompare(b.token, undefined, { numeric: true });
  });
}

function deriveAppointmentTasks(appointments: Appointment[], existingTasks: DoctorTaskItem[], doctorId?: string): DoctorTaskItem[] {
  const linkedAppointmentIds = new Set(existingTasks.map((task) => task.appointmentId).filter(Boolean));
  const today = getLocalDateISO();
  return appointments
    .filter((appointment) => appointment.doctorId === doctorId)
    .filter((appointment) => !["Cancelled", "No Show"].includes(appointment.status))
    .filter((appointment) => !linkedAppointmentIds.has(appointment.id))
    .sort(compareAppointmentsForActiveList)
    .map((appointment) => {
      const status: DoctorTaskItem["status"] =
        appointment.status === "Completed"
          ? "completed"
          : appointment.status === "In Consultation" || appointment.status === "Checked In" || appointment.date <= today
            ? "today"
            : "upcoming";
      return {
        id: `appointment-${appointment.id}`,
        appointmentId: appointment.id,
        kind: "appointment",
        title: `Appointment: ${appointment.reason}`,
        patientId: appointment.patientId,
        workplaceId: appointment.workplaceId ?? "",
        source: "Appointment",
        assignedBy: "Appointment schedule",
        dueTime: `${appointment.date} ${appointment.time}`,
        priority: appointment.status === "In Consultation" || appointment.status === "Checked In" ? "High" : "Medium",
        status,
      };
    });
}

function mergeDoctorTasks(tasks: DoctorTaskItem[], appointments: Appointment[], doctorId?: string) {
  return [...tasks, ...deriveAppointmentTasks(appointments, tasks, doctorId)].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return a.dueTime.localeCompare(b.dueTime);
  });
}

export function DoctorWorkflowProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setSelectedWorkplaceId, setWorkContext } = useMode();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [clinicQueue, setClinicQueue] = useState<ClinicQueueItem[]>([]);
  const [hospitalWorklist, setHospitalWorklist] = useState<HospitalWorkItem[]>([]);
  const [doctorTasks, setDoctorTasks] = useState<DoctorTaskItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyOrder[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState<string | undefined>();
  const [currentDoctorName, setCurrentDoctorName] = useState("Doctor");
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>();
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(true);
  const [workflowError, setWorkflowError] = useState<string | undefined>();

  const activeShift = shifts.find((shift) => shift.status === "active");
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId);

  useEffect(() => {
    if (!pathname.startsWith("/doctor")) {
      setWorkflowError(undefined);
      setBackendDoctorId(undefined);
      setWorkplaces(doctorWorkplaces);
      setShifts(doctorShiftsSeed);
      setClinicQueue(clinicQueueSeed);
      setHospitalWorklist(hospitalWorklistSeed);
      setDoctorTasks(doctorTasksSeed);
      setPatients([]);
      setDoctors([]);
      setStaff([]);
      setAppointments([]);
      setDiagnoses([]);
      setPrescriptions([]);
      setLabOrders([]);
      setRadiologyOrders([]);
      setFollowUps([]);
      setAlerts([]);
      setIsLoadingWorkflow(false);
      return;
    }

    let cancelled = false;
    setWorkflowError(undefined);
    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        const doctorId = data.currentDoctorId ?? data.doctors[0]?.id;
        const normalizedAppointments: Appointment[] = data.appointments.map((appointment) => {
          const workplace = data.workplaces.find((item) => item.id === appointment.workplaceId);
          return { ...appointment, workContext: workplace?.type === "hospital" ? "hospital" as const : "clinic" as const };
        });
        const contextForWorkplace = (workplaceId?: string) =>
          data.workplaces.find((item) => item.id === workplaceId)?.type === "hospital" ? "hospital" as const : "clinic" as const;
        const normalizedPatients = data.patients.map((patient) => ({
          ...patient,
          workContexts: (patient.workplaceIds ?? []).map(contextForWorkplace).filter((value, index, values) => values.indexOf(value) === index),
        }));
        const normalizedDiagnoses = data.diagnoses.map((item) => ({ ...item, workContext: contextForWorkplace(item.workplaceId) }));
        const normalizedPrescriptions = data.prescriptions.map((item) => ({ ...item, workContext: contextForWorkplace(item.workplaceId) }));
        const normalizedLabOrders = data.labOrders.map((item) => ({ ...item, workContext: contextForWorkplace(item.workplaceId) }));
        const normalizedRadiologyOrders = data.radiologyOrders.map((item) => ({ ...item, workContext: contextForWorkplace(item.workplaceId) }));
        const normalizedFollowUps = data.followUps.map((item) => ({ ...item, workContext: contextForWorkplace(item.workplaceId) }));
        setBackendDoctorId(doctorId);
        setCurrentDoctorName(data.doctors.find((doctor) => doctor.id === doctorId)?.name ?? "Doctor");
        setWorkplaces(data.workplaces);
        if (data.workplaceId) {
          setSelectedWorkplaceId(data.workplaceId);
          const activeWorkplace = data.workplaces.find((workplace) => workplace.id === data.workplaceId);
          if (activeWorkplace) setWorkContext(workplaceToContext(activeWorkplace.type));
        }
        setShifts(data.shifts);
        setAppointments(normalizedAppointments);
        setPatients(normalizedPatients);
        setDoctors(data.doctors);
        setStaff(data.staff);
        setDiagnoses(normalizedDiagnoses);
        setPrescriptions(normalizedPrescriptions);
        setLabOrders(normalizedLabOrders);
        setRadiologyOrders(normalizedRadiologyOrders);
        setFollowUps(normalizedFollowUps);
        setAlerts(data.alerts);
        setClinicQueue(buildClinicQueue(normalizedAppointments, data.workplaces, doctorId));
        setHospitalWorklist(data.admissions);
        setDoctorTasks(mergeDoctorTasks(data.tasks, normalizedAppointments, doctorId));
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkflowError(error instanceof Error ? error.message : "Doctor database sync failed.");
          setBackendDoctorId(undefined);
          setCurrentDoctorName("Doctor");
          setWorkplaces([]);
          setShifts([]);
          setAppointments([]);
          setPatients([]);
          setDoctors([]);
          setStaff([]);
          setDiagnoses([]);
          setPrescriptions([]);
          setLabOrders([]);
          setRadiologyOrders([]);
          setFollowUps([]);
          setAlerts([]);
          setClinicQueue([]);
          setHospitalWorklist([]);
          setDoctorTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkflow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, setSelectedWorkplaceId, setWorkContext]);

  function getWorkplace(id: string) {
    return workplaces.find((workplace) => workplace.id === id);
  }

  function startShift(id: string) {
    const shift = shifts.find((item) => item.id === id);
    const workplace = shift ? getWorkplace(shift.workplaceId) : undefined;
    if (!shift) return;
    void updateBackendShiftStatus(id, "active", shift.workplaceId).then(() => {
      setShifts((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === id ? "active" : item.status === "active" ? "upcoming" : item.status,
        }))
      );
      if (workplace) {
        setWorkContext(workplaceToContext(workplace.type));
        setSelectedWorkplaceId(workplace.id);
      }
    }).catch(() => undefined);
  }

  function completeShift(id: string) {
    const shift = shifts.find((item) => item.id === id);
    if (!shift) return;
    void updateBackendShiftStatus(id, "completed", shift.workplaceId)
      .then(() => setShifts((prev) => prev.map((item) => (item.id === id ? { ...item, status: "completed" } : item))))
      .catch(() => undefined);
  }

  function updateShiftStatus(id: string, status: ShiftStatus) {
    const shift = shifts.find((item) => item.id === id);
    if (!shift) return;
    void updateBackendShiftStatus(id, status, shift.workplaceId)
      .then(() => setShifts((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item))))
      .catch(() => undefined);
  }

  function addShift(shift: DoctorShift) {
    setShifts((prev) => [shift, ...prev]);
  }

  function addPrescription(prescription: Prescription) {
    setPrescriptions((prev) => [prescription, ...prev.filter((item) => item.id !== prescription.id)]);
  }

  function startQueueConsultation(id: string) {
    const item = clinicQueue.find((entry) => entry.id === id);
    if (!item) return;
    const moveToConsultation = async () => {
      if (item.status === "upcoming") {
        await updateBackendAppointmentStatus(id, "Checked In", item.workplaceId);
      }
      await updateBackendAppointmentStatus(id, "In Consultation", item.workplaceId);
      setClinicQueue((prev) => updateQueueStatus(prev, id, "in_consultation"));
      setAppointments((prev) => prev.map((appointment) => appointment.id === id ? { ...appointment, status: "In Consultation" } : appointment));
      setDoctorTasks((prev) => prev.map((task) => task.appointmentId === id ? { ...task, status: "today", priority: "High" } : task));
    };
    void moveToConsultation().catch(() => undefined);
  }

  function completeQueueConsultation(id: string) {
    const item = clinicQueue.find((entry) => entry.id === id);
    if (!item) return;
    void updateBackendAppointmentStatus(id, "Completed", item.workplaceId)
      .then(() => markAppointmentCompleted(id))
      .catch(() => undefined);
  }

  function markAppointmentCompleted(id: string) {
    setAppointments((prev) => prev.map((appointment) => appointment.id === id ? { ...appointment, status: "Completed" as const } : appointment).sort(compareAppointmentsForActiveList));
    setClinicQueue((prev) => updateQueueStatus(prev, id, "completed"));
    setDoctorTasks((prev) => prev.map((task) => task.appointmentId === id ? { ...task, status: "completed" } : task));
  }

  function acceptHospitalRequest(id: string) {
    setHospitalWorklist((prev) => prev.map((item) => item.id === id ? { ...item, status: "assigned", reasonAssigned: "Accepted consult request" } : item));
  }

  function completeHospitalItem(id: string) {
    const item = hospitalWorklist.find((entry) => entry.id === id);
    if (!item) return;
    void completeBackendAdmission(item.admissionId ?? item.id, item.workplaceId, "Doctor review completed")
      .then(() => setHospitalWorklist((prev) => prev.map((entry) => entry.id === id ? { ...entry, status: "completed", reasonAssigned: "Doctor clearance completed" } : entry)))
      .catch(() => undefined);
  }

  function handoverHospitalItem(id: string, doctorName: string) {
    const item = hospitalWorklist.find((entry) => entry.id === id);
    if (!item) return;
    void sendBackendMessage({
      workplaceId: item.workplaceId,
      title: "Hospital duty handover",
      body: `Patient ${item.patientId} handed over to ${doctorName}.`,
    }).then(() => setHospitalWorklist((prev) => prev.map((entry) => entry.id === id ? { ...entry, handedOverTo: doctorName, reasonAssigned: `Handed over to ${doctorName}` } : entry))).catch(() => undefined);
  }

  function completeTask(id: string) {
    const task = doctorTasks.find((entry) => entry.id === id);
    if (!task) return;
    if (task.kind === "appointment" && task.appointmentId) {
      const completeAppointmentTask = async () => {
        const appointment = appointments.find((item) => item.id === task.appointmentId);
        if (appointment?.status === "Scheduled") {
          await updateBackendAppointmentStatus(task.appointmentId!, "Checked In", task.workplaceId);
        }
        if (appointment?.status !== "In Consultation") {
          await updateBackendAppointmentStatus(task.appointmentId!, "In Consultation", task.workplaceId);
        }
        await updateBackendAppointmentStatus(task.appointmentId!, "Completed", task.workplaceId);
      };
      void completeAppointmentTask()
        .then(() => markAppointmentCompleted(task.appointmentId!))
        .catch(() => undefined);
      return;
    }
    void updateBackendTaskStatus(id, task.workplaceId, "COMPLETED")
      .then(() => setDoctorTasks((prev) => prev.map((entry) => entry.id === id ? { ...entry, status: "completed" } : entry)))
      .catch(() => undefined);
  }

  function startTask(id: string) {
    const task = doctorTasks.find((entry) => entry.id === id);
    if (!task) return;
    if (task.kind === "appointment" && task.appointmentId) {
      const moveAppointmentToConsultation = async () => {
        const appointment = appointments.find((item) => item.id === task.appointmentId);
        if (appointment?.status === "Scheduled") {
          await updateBackendAppointmentStatus(task.appointmentId!, "Checked In", task.workplaceId);
        }
        await updateBackendAppointmentStatus(task.appointmentId!, "In Consultation", task.workplaceId);
      };
      void moveAppointmentToConsultation()
        .then(() => {
          setAppointments((prev) => prev.map((appointment) => appointment.id === task.appointmentId ? { ...appointment, status: "In Consultation" } : appointment));
          setClinicQueue((prev) => updateQueueStatus(prev, task.appointmentId!, "in_consultation"));
          setDoctorTasks((prev) => prev.map((entry) => entry.id === id ? { ...entry, status: "today", priority: "High" } : entry));
        })
        .catch(() => undefined);
      return;
    }
    void updateBackendTaskStatus(id, task.workplaceId, "IN_PROGRESS")
      .then(() => setDoctorTasks((prev) => prev.map((entry) => entry.id === id ? { ...entry, status: "today" } : entry)))
      .catch(() => undefined);
  }

  const value = {
    isLoadingWorkflow,
    workflowError,
    workplaces,
    shifts,
    clinicQueue,
    hospitalWorklist,
    doctorTasks,
    patients,
    doctors,
    staff,
    appointments,
    diagnoses,
    prescriptions,
    labOrders,
    radiologyOrders,
    followUps,
    alerts,
    backendDoctorId,
    currentDoctorName,
    activeShift,
    selectedShift,
    selectShift: setSelectedShiftId,
    getWorkplace,
    startShift,
    completeShift,
    addShift,
    addPrescription,
    updateShiftStatus,
    startQueueConsultation,
    completeQueueConsultation,
    markAppointmentCompleted,
    acceptHospitalRequest,
    completeHospitalItem,
    handoverHospitalItem,
    completeTask,
    startTask,
  };

  return <DoctorWorkflowContext.Provider value={value}>{children}</DoctorWorkflowContext.Provider>;
}

export function useDoctorWorkflow() {
  const ctx = useContext(DoctorWorkflowContext);
  if (!ctx) throw new Error("useDoctorWorkflow must be used within DoctorWorkflowProvider");
  return ctx;
}
 
