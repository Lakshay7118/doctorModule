// Shared receptionist UI types and temporary IDs for optimistic rows.

export type Gender = "Male" | "Female" | "Other";

export interface Patient {
  uhid: string;
  backendId?: string;
  primaryDoctorId?: string;
  workplaceId?: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  department: string;
  bloodGroup?: string;
  lastVisit: string;
  status: "Active" | "Deactivated" | "Discharged" | "New";
}

export interface Appointment {
  id: string;
  backendId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  doctor: string;
  department: string;
  date: string;
  time: string;
  status: "Confirmed" | "Pending" | "Cancelled" | "Completed";
}

export interface QueueEntry {
  token: string;
  appointmentId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  patient: string;
  doctor: string;
  department: string;
  checkedInAt: string;
  status: "Waiting" | "In Consultation" | "Completed";
}

export interface Visitor {
  id: string;
  patientId?: string;
  name: string;
  visiting: string;
  ward: string;
  relation: string;
  passIssued: string;
  status: "Checked In" | "Checked Out";
}

export interface Admission {
  id: string;
  backendId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  ward: string;
  bed: string;
  doctor: string;
  admittedOn: string;
  status: "Admitted" | "Awaiting Bed" | "Discharged";
}

export interface ReceptionistDoctor {
  name: string;
  department: string;
  backendId?: string;
}

export function generateUHID(existing: Patient[]): string {
  const max = existing.reduce((m, p) => {
    const n = parseInt(p.uhid.replace("UHID-", ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 24600);
  return `UHID-${max + 1}`;
}

export function generateToken(existing: QueueEntry[]): string {
  const max = existing.reduce((m, q) => {
    const n = parseInt(q.token.replace("T-", ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `T-${String(max + 1).padStart(3, "0")}`;
}
