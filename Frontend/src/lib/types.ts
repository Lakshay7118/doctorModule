// Core domain types for the Qlyno frontend.
// This mirrors the data model in "Updated core data model" (section 20)
// of the combined Doctor/Provider module spec. Frontend-only: no persistence,
// no API calls — everything here backs mock/in-memory data.

export type WorkContext = "clinic" | "hospital";

export type Gender = "Male" | "Female" | "Other";

export interface ClinicLocation {
  id: string;
  name: string;
  address: string;
  isPrimary?: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  logoInitial: string;
  locations: ClinicLocation[];
  services: string[];
  timings: string;
}

export type DoctorAvailability = "Available" | "Busy" | "Off" | "On Leave";

export interface Doctor {
  id: string;
  userAccountId?: string;
  name: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;
  avatarInitials: string;
  availability: DoctorAvailability;
  locationId?: string;
  rating?: number;
  patientsCount?: number;
  workplaceIds?: string[];
}

export type StaffRole = "Receptionist" | "Nurse" | "Assistant" | "Lab/Pharmacy User";

export interface StaffMember {
  id: string;
  userAccountId?: string;
  name: string;
  role: StaffRole;
  locationId?: string;
  status: "Active" | "Invited" | "Suspended";
  workplaceIds?: string[];
}

export interface Vitals {
  recordedAt: string;
  bp: string; // "120/80"
  pulse: number; // bpm
  temp: number; // F
  spo2: number; // %
  weight: number; // kg
  bmi: number;
}

export type AllergySeverity = "Mild" | "Moderate" | "Severe";

export interface Allergy {
  substance: string;
  severity: AllergySeverity;
  reaction: string;
}

export interface Patient {
  id: string;
  mrn: string; // medical record number
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  avatarInitials: string;
  primaryDoctorId: string;
  clinicId?: string;
  workplaceIds?: string[];
  workContexts?: WorkContext[];
  bloodGroup: string;
  allergies: Allergy[];
  conditions: string[];
  lastVisit: string;
  latestVitals?: Vitals;
  tags?: ("New" | "Follow-up" | "Critical" | "Shared-care")[];
}

export type AppointmentStatus =
  | "Scheduled"
  | "Checked In"
  | "In Consultation"
  | "Completed"
  | "Cancelled"
  | "No Show";

export type AppointmentType = "In-Person" | "Video" | "Follow-up";

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  locationId?: string;
  workplaceId?: string;
  workContext?: WorkContext;
  date: string; // ISO date
  time: string; // "09:30 AM"
  durationMins: number;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
}

export interface DiagnosisEntry {
  id: string;
  patientId: string;
  icdCode: string;
  description: string;
  diagnosedOn: string;
  status: "Active" | "Resolved" | "Chronic";
  doctorId: string;
  workplaceId?: string;
  workContext?: WorkContext;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  medicines: Medicine[];
  advice: string;
  status: "Active" | "Completed";
  workplaceId?: string;
  workContext?: WorkContext;
}

export type OrderStatus = "Ordered" | "Sample Collected" | "In Progress" | "Report Ready" | "Reviewed";

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  testName: string;
  orderedOn: string;
  status: OrderStatus;
  source: "Internal" | "Partner Lab" | "External / Manual";
  priority: "Routine" | "Urgent";
  workplaceId?: string;
  workContext?: WorkContext;
  report?: {
    resultSummary?: string | null;
    interpretation?: string | null;
    resultAt?: string | null;
    status?: string | null;
  };
}

export type ImagingType = "X-Ray" | "CT Scan" | "MRI" | "Ultrasound";

export interface RadiologyOrder {
  id: string;
  patientId: string;
  doctorId: string;
  imagingType: ImagingType;
  bodyRegion: string;
  orderedOn: string;
  status: OrderStatus;
  priority: "Routine" | "Urgent";
  workplaceId?: string;
  workContext?: WorkContext;
}

export interface FollowUp {
  id: string;
  patientId: string;
  doctorId: string;
  dueDate: string;
  reason: string;
  status: "Upcoming" | "Due Today" | "Overdue" | "Completed";
  workplaceId?: string;
  workContext?: WorkContext;
}

export type AlertSeverity = "Critical" | "Warning" | "Info";

export interface ClinicalAlert {
  id: string;
  severity: AlertSeverity;
  category: "Allergy" | "Abnormal Report" | "Emergency" | "Task";
  patientId?: string;
  message: string;
  time: string;
  acknowledged: boolean;
  workContext?: WorkContext;
}

export interface ConsultationNote {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  chiefComplaint: string;
  symptoms: string[];
  observations: string;
  diagnosis: string;
  plan: string;
  status: "Draft" | "Finalized";
  workContext?: WorkContext;
}

export interface Conversation {
  id: string;
  withName: string;
  withRole: "Patient" | "Nurse" | "Pharmacist" | "Lab" | "Doctor" | "Clinic Admin";
  lastMessage: string;
  time: string;
  unread: number;
}

export interface Task {
  id: string;
  title: string;
  ownerName: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In Progress" | "Done";
  workContext?: WorkContext;
}
