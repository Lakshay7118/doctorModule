import { WorkContext } from "./types";

export type WorkplaceType = "clinic" | "hospital" | "online";

export type ShiftType =
  | "clinic_opd"
  | "hospital_duty"
  | "ward_round"
  | "on_call"
  | "online_consultation"
  | "blocked"
  | "leave";

export type ShiftStatus = "upcoming" | "active" | "completed" | "cancelled";

export interface Workplace {
  id: string;
  name: string;
  type: WorkplaceType;
  location?: string;
  department?: string;
  role?: string;
  status: "Verified" | "Active" | "Pending";
  managedBy?: string;
}

export interface DoctorShift {
  id: string;
  doctorId?: string;
  workplaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  bookingEnabled?: boolean;
  slotMinutes?: number;
  bufferMinutes?: number;
  bookingLimit?: number;
  recurrenceRule?: string;
  note?: string;
}

export type QueueStatus = "waiting" | "in_consultation" | "upcoming" | "completed" | "no_show";

export interface ClinicQueueItem {
  id: string;
  token: string;
  patientId: string;
  workplaceId: string;
  appointmentTime: string;
  reason: string;
  waitingMins: number;
  status: QueueStatus;
}

export type HospitalWorkStatus = "assigned" | "request" | "critical" | "reports" | "discharge" | "completed";

export interface HospitalWorkItem {
  id: string;
  patientId: string;
  workplaceId: string;
  admissionId?: string;
  encounterId?: string;
  bed: string;
  diagnosis: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  reasonAssigned: string;
  status: HospitalWorkStatus;
  requestedBy?: string;
  requestDepartment?: string;
  requestReason?: string;
  requestedAt?: string;
  pending?: string[];
  handedOverTo?: string;
}

export interface DoctorTaskItem {
  id: string;
  appointmentId?: string;
  kind?: "task" | "appointment";
  title: string;
  patientId?: string;
  workplaceId: string;
  source: string;
  assignedBy: string;
  dueTime: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "urgent" | "today" | "upcoming" | "completed";
}

export interface EncounterDraft {
  chiefComplaint: string;
  symptoms: string;
  examination: string;
  vitals: string;
  diagnosis: string;
  icdCode: string;
  notes: string;
  treatmentPlan: string;
  prescription: string;
  labOrder: string;
  radiologyOrder: string;
  followUp: string;
}

export function workplaceToContext(type: WorkplaceType): WorkContext {
  return type === "hospital" ? "hospital" : "clinic";
}

export function shiftTypeLabel(type: ShiftType) {
  const labels: Record<ShiftType, string> = {
    clinic_opd: "Clinic OPD",
    hospital_duty: "Hospital Duty",
    ward_round: "Ward Round",
    on_call: "On Call",
    online_consultation: "Online Consultation",
    blocked: "Blocked",
    leave: "Leave",
  };
  return labels[type];
}
