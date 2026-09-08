// Seed data for the Receptionist Portal. The data-context hydrates from the
// backend when available and falls back to these rows for offline demo work.

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
  status: "Active" | "Discharged" | "New";
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
  name: string;
  visiting: string;
  ward: string;
  relation: string;
  passIssued: string;
  status: "Checked In" | "Checked Out";
}

export interface Admission {
  id: string;
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

export const doctors: ReceptionistDoctor[] = [
  { name: "Dr. Ananya Rao", department: "General Medicine" },
  { name: "Dr. Vikram Shah", department: "Orthopedics" },
  { name: "Dr. Meera Iyer", department: "Pediatrics" },
  { name: "Dr. Sanjay Kapoor", department: "Cardiology" },
  { name: "Dr. Priya Menon", department: "Gynecology" },
  { name: "Dr. Rohan Desai", department: "ENT" },
];

export const departments = [
  "General Medicine",
  "Orthopedics",
  "Pediatrics",
  "Cardiology",
  "Gynecology",
  "ENT",
  "Emergency",
];

export const wards = ["General Ward A", "General Ward B", "ICU", "Maternity", "Pediatric Ward", "Deluxe Room 1", "Deluxe Room 2"];

function currentDisplayDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export const initialPatients: Patient[] = [
  { uhid: "UHID-24601", name: "Ramesh Chandra Verma", age: 54, gender: "Male", phone: "98765 43210", department: "Cardiology", lastVisit: currentDisplayDate(-1), status: "Active" },
  { uhid: "UHID-24598", name: "Sunita Agarwal", age: 32, gender: "Female", phone: "98123 44556", department: "Gynecology", lastVisit: currentDisplayDate(-2), status: "Active" },
  { uhid: "UHID-24587", name: "Aarav Mehta", age: 7, gender: "Male", phone: "99887 65432", department: "Pediatrics", lastVisit: currentDisplayDate(), status: "New" },
  { uhid: "UHID-24560", name: "Firoz Khan", age: 61, gender: "Male", phone: "97654 32109", department: "Orthopedics", lastVisit: currentDisplayDate(-9), status: "Discharged" },
  { uhid: "UHID-24552", name: "Lakshmi Narayanan", age: 45, gender: "Female", phone: "96543 21098", department: "General Medicine", lastVisit: currentDisplayDate(-11), status: "Active" },
];

export const initialAppointments: Appointment[] = [
  { id: "APT-1042", patient: "Ramesh Chandra Verma", uhid: "UHID-24601", doctor: "Dr. Sanjay Kapoor", department: "Cardiology", date: currentDisplayDate(), time: "11:30 AM", status: "Confirmed" },
  { id: "APT-1041", patient: "Sunita Agarwal", uhid: "UHID-24598", doctor: "Dr. Priya Menon", department: "Gynecology", date: currentDisplayDate(), time: "12:15 PM", status: "Pending" },
  { id: "APT-1039", patient: "Aarav Mehta", uhid: "UHID-24587", doctor: "Dr. Meera Iyer", department: "Pediatrics", date: currentDisplayDate(), time: "10:00 AM", status: "Completed" },
  { id: "APT-1035", patient: "Firoz Khan", uhid: "UHID-24560", doctor: "Dr. Vikram Shah", department: "Orthopedics", date: currentDisplayDate(1), time: "09:45 AM", status: "Confirmed" },
];

export const initialQueue: QueueEntry[] = [
  { token: "T-014", patient: "Ramesh Chandra Verma", doctor: "Dr. Sanjay Kapoor", department: "Cardiology", checkedInAt: "10:58 AM", status: "In Consultation" },
  { token: "T-015", patient: "Sunita Agarwal", doctor: "Dr. Priya Menon", department: "Gynecology", checkedInAt: "11:05 AM", status: "Waiting" },
  { token: "T-016", patient: "Deepak Sinha", doctor: "Dr. Ananya Rao", department: "General Medicine", checkedInAt: "11:12 AM", status: "Waiting" },
  { token: "T-013", patient: "Aarav Mehta", doctor: "Dr. Meera Iyer", department: "Pediatrics", checkedInAt: "10:40 AM", status: "Completed" },
];

export const initialVisitors: Visitor[] = [
  { id: "VIS-3301", name: "Karan Verma", visiting: "Ramesh Chandra Verma", ward: "ICU", relation: "Son", passIssued: "10:20 AM", status: "Checked In" },
  { id: "VIS-3298", name: "Alok Agarwal", visiting: "Sunita Agarwal", ward: "Maternity", relation: "Husband", passIssued: "09:40 AM", status: "Checked In" },
  { id: "VIS-3290", name: "Neha Sinha", visiting: "Deepak Sinha", ward: "General Ward A", relation: "Sister", passIssued: "08:55 AM", status: "Checked Out" },
];

export const initialAdmissions: Admission[] = [
  { id: "IPD-2231", patient: "Ramesh Chandra Verma", uhid: "UHID-24601", ward: "ICU", bed: "ICU-04", doctor: "Dr. Sanjay Kapoor", admittedOn: currentDisplayDate(-1), status: "Admitted" },
  { id: "IPD-2229", patient: "Sunita Agarwal", uhid: "UHID-24598", ward: "Maternity", bed: "MAT-11", doctor: "Dr. Priya Menon", admittedOn: currentDisplayDate(-2), status: "Admitted" },
  { id: "IPD-2225", patient: "Firoz Khan", uhid: "UHID-24560", ward: "General Ward B", bed: "GWB-06", doctor: "Dr. Vikram Shah", admittedOn: currentDisplayDate(-9), status: "Discharged" },
];

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
