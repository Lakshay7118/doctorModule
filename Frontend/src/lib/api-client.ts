import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  ClinicLocation,
  ClinicalAlert,
  Conversation,
  ConsultationNote,
  DiagnosisEntry,
  Doctor,
  FollowUp,
  LabOrder,
  Medicine,
  OrderStatus,
  Patient,
  Prescription,
  RadiologyOrder,
  StaffMember,
  Vitals,
  WorkContext,
} from "./types";
import { DoctorShift, DoctorTaskItem, HospitalWorkItem, ShiftStatus, ShiftType, Workplace, WorkplaceType } from "./doctor-workflow-types";
import { getLocalDateISO } from "./app-time";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const HMS_AUTH_KEY = "qlyno.hms.auth.v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiSyncSkippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiSyncSkippedError";
  }
}

export function isUuid(value: string | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

function requireUuid(value: string, label: string) {
  if (!isUuid(value)) {
    throw new ApiSyncSkippedError(`${label} is a mock id. Backend sync needs UUID data loaded from the API.`);
  }
}

function getHmsAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(HMS_AUTH_KEY) ?? window.sessionStorage.getItem(HMS_AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: unknown };
    return typeof parsed.accessToken === "string" ? parsed.accessToken : null;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getHmsAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ?? `Backend request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function appointmentMode(type: AppointmentType) {
  if (type === "Video") return "VIDEO";
  return "IN_PERSON";
}

function appointmentStatus(status: AppointmentStatus) {
  const map: Record<AppointmentStatus, string> = {
    Scheduled: "SCHEDULED",
    "Checked In": "CHECKED_IN",
    "In Consultation": "IN_CONSULTATION",
    Completed: "COMPLETED",
    Cancelled: "CANCELLED",
    "No Show": "NO_SHOW",
  };
  return map[status];
}

function orderStatus(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    Ordered: "ORDERED",
    "Sample Collected": "SAMPLE_COLLECTED",
    "In Progress": "IN_PROGRESS",
    "Report Ready": "RESULT_READY",
    Reviewed: "REVIEWED",
  };
  return map[status];
}

export function toIsoDateTime(date: string, time: string) {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return new Date(`${date}T${trimmed}`).toISOString();
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridian = match[3].toUpperCase();
  if (meridian === "PM" && hours !== 12) hours += 12;
  if (meridian === "AM" && hours === 12) hours = 0;

  // The form is entered in the user's local timezone. Convert it to UTC only
  // when sending it to the backend so availability checks use the same instant.
  return new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
}

export async function getBackendHealth() {
  return requestJson<{ ok: boolean; database: "not_configured" | "ok" | "error" }>("/health");
}

export interface BackendLaboratoryCatalogItem {
  id: string;
  code: string;
  name: string;
  departmentId?: string | null;
}

export interface BackendLaboratoryPatient {
  id: string;
  mrn?: string | null;
  name: string;
  dateOfBirth?: string | null;
  sex: "M" | "F" | "O";
  contact: string;
  source: string;
  branchOrWard?: string | null;
}

export interface BackendLaboratoryEncounter {
  id: string;
  patientId: string;
  encounterNo: string;
  ward?: string | null;
  bed?: string | null;
  admittingDoctor?: string | null;
  status: string;
}

export interface BackendLaboratoryOrder {
  id: string;
  patientId: string;
  siteId: string;
  encounterId?: string | null;
  source: string;
  priority: string;
  status: string;
  orderingDoctor: string;
  placedAt: string;
}

export async function getBackendLaboratoryCatalog() {
  const payload = await requestJson<{ data: BackendLaboratoryCatalogItem[] }>("/api/catalog");
  return payload.data;
}

export async function createBackendLaboratoryPatient(input: {
  mrn?: string;
  name: string;
  dateOfBirth?: string;
  sex: "M" | "F" | "O";
  contact: string;
  source: "HOSPITAL_ENCOUNTER" | "WALK_IN" | "HOME_COLLECTION" | "B2B_CLIENT" | "INTERNAL_NO_CHARGE";
  branchOrWard?: string;
}) {
  const payload = await requestJson<{ data: BackendLaboratoryPatient }>("/api/patients", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function getBackendPatients() {
  const data = await getBackendBootstrap();
  return data.patients;
}

export async function createBackendLaboratoryEncounter(input: {
  patientId: string;
  encounterNo: string;
  ward?: string;
  bed?: string;
  admittingDoctor?: string;
  status: string;
}) {
  const payload = await requestJson<{ data: BackendLaboratoryEncounter }>("/api/encounters", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function createBackendLaboratoryOrder(input: {
  siteId: string;
  patientId: string;
  encounterId?: string;
  source: "HOSPITAL_ENCOUNTER" | "WALK_IN" | "HOME_COLLECTION" | "B2B_CLIENT" | "INTERNAL_NO_CHARGE";
  priority: "ROUTINE" | "URGENT" | "STAT";
  orderingDoctor: string;
  collectionLocation: string;
  scheduledAt?: string;
  testIds: string[];
}) {
  const payload = await requestJson<{ data: BackendLaboratoryOrder }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
}

interface BackendLocation {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  isPrimary?: boolean;
}

interface BackendWorkplace {
  id: string;
  name: string;
  type: "SOLO_PRACTICE" | "CLINIC" | "HOSPITAL" | "ONLINE_PRACTICE";
  locations?: BackendLocation[];
  workplace_locations?: BackendLocation[];
  legalName?: string | null;
  status?: string;
}

interface BackendDoctor {
  id: string;
  userAccountId?: string | null;
  fullName: string;
  specialty: string;
  qualifications?: string | null;
  experienceYears?: number | null;
  doctor_workplaces?: Array<{ workplaceId: string }>;
}

interface BackendPatient {
  id: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  bloodGroup?: string | null;
  primaryDoctorId?: string | null;
  workplaces?: Array<{ localMrn?: string | null; workplaceId: string }>;
  patient_workplaces?: Array<{ localMrn?: string | null; workplaceId: string }>;
  allergies?: Array<{ substance: string; severity: "MILD" | "MODERATE" | "SEVERE"; reaction?: string | null }>;
  patient_allergies?: Array<{ substance: string; severity: "MILD" | "MODERATE" | "SEVERE"; reaction?: string | null }>;
  conditions?: Array<{ name: string }>;
  patient_conditions?: Array<{ name: string }>;
}

interface BackendAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  locationId?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  mode: "IN_PERSON" | "VIDEO" | "HOME" | "HOSPITAL";
  status: string;
  reason?: string | null;
  checkedInAt?: string | null;
}

interface BackendShift {
  id: string;
  doctorId: string;
  workplaceId: string;
  startsAt: string;
  endsAt: string;
  shiftType: string;
  status: string;
  bookingEnabled: boolean;
  slotMinutes?: number | null;
  bufferMinutes?: number | null;
  bookingLimit?: number | null;
  recurrenceRule?: string | null;
  note?: string | null;
}

interface BackendClinicService {
  id: string;
  workplaceId: string;
  name: string;
  durationMinutes: number;
  price?: string | number | null;
  eligibleDoctors?: Array<{ doctorId: string }>;
}

interface BackendDiagnosis {
  id: string;
  patientId: string;
  icdCode?: string | null;
  description: string;
  status: string;
  diagnosedAt: string;
  encounters?: { workplaceId: string; doctorId: string } | null;
}

interface BackendPrescription {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  status: string;
  advice?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  medicines: Array<{
    id: string;
    medicineName: string;
    strength?: string | null;
    dose?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
  }>;
}

interface BackendOrder {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  type: "LABORATORY" | "RADIOLOGY" | "EXTERNAL_REPORT";
  title: string;
  status: string;
  priority: string;
  source?: string | null;
  orderedAt: string;
  reports?: { resultSummary?: string | null; interpretation?: string | null; resultAt?: string | null; status?: string | null } | null;
}

interface BackendFollowUp {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  status: string;
  dueAt?: string | null;
  reason: string;
}

interface BackendEncounter {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  appointmentId?: string | null;
  type: string;
  status: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  treatmentPlan?: string | null;
  createdAt: string;
}

interface BackendTask {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueAt?: string | null;
  patientId?: string | null;
  workplaceId?: string | null;
  appointmentId?: string | null;
  createdAt: string;
  task_assignees?: Array<{ user_accounts?: { email: string } | null }>;
}

interface BackendAdmission {
  id: string;
  patientId: string;
  workplaceId: string;
  encounterId: string;
  status: string;
  doctorCleared: boolean;
  admittedAt: string;
  bed?: { code: string } | null;
  encounters?: {
    assessment?: string | null;
    diagnoses?: Array<{ description: string; status: string }>;
  } | null;
}

interface BackendVitalSet {
  id: string;
  patientId: string;
  recordedAt: string;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  pulse?: number | null;
  temperatureF?: string | number | null;
  spo2?: number | null;
  weightKg?: string | number | null;
  bmi?: string | number | null;
}

interface BackendStaff {
  id: string;
  userAccountId?: string | null;
  fullName: string;
  role: string;
  status: string;
  memberships?: Array<{ workplaceId: string; role?: string | null }>;
  staff_workplaces?: Array<{ workplaceId: string; role?: string | null }>;
}

interface BackendNotification {
  id: string;
  workplaceId?: string | null;
  patientId?: string | null;
  severity: "CRITICAL" | "ACTION_REQUIRED" | "REMINDER" | "INFORMATION";
  category: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface BackendConversation {
  id: string;
  type: "PATIENT" | "CLINIC_STAFF" | "DOCTOR" | "REFERRAL";
  title?: string | null;
  participants: Array<{ displayName: string; participantType: string; userAccountId?: string | null; isSelf?: boolean; lastReadAt?: string | null }>;
  messages: Array<{ id: string; senderUserId?: string | null; isMine?: boolean; body: string; sentAt: string }>;
  updatedAt: string;
}

export interface BackendChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
}

export interface BackendConversationRow extends Conversation {
  messages: BackendChatMessage[];
}

interface BackendBootstrapPayload {
  currentDoctorId?: string;
  doctors: BackendDoctor[];
  workplaces: BackendWorkplace[];
  patients: BackendPatient[];
  appointments: BackendAppointment[];
  shifts: BackendShift[];
  services: BackendClinicService[];
  diagnoses: BackendDiagnosis[];
  prescriptions: BackendPrescription[];
  orders: BackendOrder[];
  followUps: BackendFollowUp[];
  vitals: BackendVitalSet[];
  staff: BackendStaff[];
  notifications: BackendNotification[];
  tasks: BackendTask[];
  admissions: BackendAdmission[];
  encounters: BackendEncounter[];
}

export interface BackendClinicServiceRow {
  id: string;
  name: string;
  eligibleDoctorIds: string[];
  durationMinutes: number;
  price: number;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function frontendGender(gender: BackendPatient["gender"]): Patient["gender"] {
  if (gender === "FEMALE") return "Female";
  if (gender === "MALE") return "Male";
  return "Other";
}

function backendLaboratorySex(gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN") {
  if (gender === "MALE") return "M";
  if (gender === "FEMALE") return "F";
  return "O";
}

function frontendGenderFromLaboratorySex(sex: BackendLaboratoryPatient["sex"]): Patient["gender"] {
  if (sex === "F") return "Female";
  if (sex === "M") return "Male";
  return "Other";
}

function toFrontendPatientFromLaboratoryPatient(patient: BackendLaboratoryPatient): Patient {
  return {
    id: patient.id,
    mrn: patient.mrn ?? patient.id,
    name: patient.name,
    age: ageFromBirthDate(patient.dateOfBirth),
    gender: frontendGenderFromLaboratorySex(patient.sex),
    phone: patient.contact,
    avatarInitials: initials(patient.name),
    primaryDoctorId: "",
    clinicId: "clinic-1",
    workContexts: ["clinic"],
    bloodGroup: "-",
    allergies: [],
    conditions: [],
    lastVisit: "Backend",
    tags: ["New"],
  };
}

function toFrontendPatient(patient: BackendPatient): Patient {
  const workplaces = patient.workplaces ?? patient.patient_workplaces ?? [];
  const allergies = patient.allergies ?? patient.patient_allergies ?? [];
  const conditions = patient.conditions ?? patient.patient_conditions ?? [];
  const workplace = workplaces[0];
  return {
    id: patient.id,
    mrn: workplace?.localMrn ?? patient.id.slice(0, 8),
    name: patient.fullName,
    age: ageFromBirthDate(patient.dateOfBirth),
    gender: frontendGender(patient.gender),
    phone: patient.phone ?? "Not added",
    avatarInitials: initials(patient.fullName),
    primaryDoctorId: patient.primaryDoctorId ?? "",
    clinicId: workplace?.workplaceId,
    workContexts: ["clinic"],
    bloodGroup: patient.bloodGroup ?? "-",
    allergies: allergies.map((allergy) => ({
      substance: allergy.substance,
      severity: allergy.severity === "SEVERE" ? "Severe" : allergy.severity === "MODERATE" ? "Moderate" : "Mild",
      reaction: allergy.reaction ?? "",
    })),
    conditions: conditions.map((condition) => condition.name),
    lastVisit: "Backend",
    tags: ["New"],
  };
}

function frontendAppointmentType(mode: BackendAppointment["mode"]): AppointmentType {
  return mode === "VIDEO" ? "Video" : "In-Person";
}

function frontendAppointmentStatus(status: string): AppointmentStatus {
  const map: Record<string, AppointmentStatus> = {
    SCHEDULED: "Scheduled",
    CONFIRMED: "Scheduled",
    CHECKED_IN: "Checked In",
    WAITING: "Checked In",
    IN_CONSULTATION: "In Consultation",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No Show",
  };
  return map[status] ?? "Scheduled";
}

function frontendWorkplaceType(type: BackendWorkplace["type"]): WorkplaceType {
  if (type === "HOSPITAL") return "hospital";
  if (type === "ONLINE_PRACTICE") return "online";
  return "clinic";
}

function frontendShiftType(type: string): ShiftType {
  const map: Record<string, ShiftType> = {
    CLINIC_OPD: "clinic_opd",
    HOSPITAL_DUTY: "hospital_duty",
    WARD_ROUND: "ward_round",
    ON_CALL: "on_call",
    ONLINE_CONSULTATION: "online_consultation",
    BLOCKED: "blocked",
    LEAVE: "leave",
  };
  return map[type] ?? "clinic_opd";
}

function frontendShiftStatus(status: string): ShiftStatus {
  const map: Record<string, ShiftStatus> = {
    DRAFT: "upcoming",
    UPCOMING: "upcoming",
    ACTIVE: "active",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  return map[status] ?? "upcoming";
}

function frontendOrderStatus(status: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    PENDING: "Ordered",
    ORDERED: "Ordered",
    SAMPLE_COLLECTED: "Sample Collected",
    IN_PROGRESS: "In Progress",
    SCHEDULED: "In Progress",
    RESULT_READY: "Report Ready",
    CRITICAL: "Report Ready",
    REVIEWED: "Reviewed",
    CANCELLED: "Reviewed",
  };
  return map[status] ?? "Ordered";
}

function frontendOrderPriority(priority: string): "Routine" | "Urgent" {
  return priority === "URGENT" || priority === "CRITICAL" || priority === "HIGH" ? "Urgent" : "Routine";
}

function frontendDiagnosisStatus(status: string): DiagnosisEntry["status"] {
  if (status === "CHRONIC") return "Chronic";
  if (status === "RESOLVED" || status === "RULED_OUT") return "Resolved";
  return "Active";
}

function frontendPrescriptionStatus(status: string): Prescription["status"] {
  return status === "COMPLETED" || status === "CANCELLED" ? "Completed" : "Active";
}

function frontendFollowUpStatus(status: string, dueAt?: string | null): FollowUp["status"] {
  if (status === "COMPLETED") return "Completed";
  if (status === "OVERDUE") return "Overdue";
  const dueDate = dueAt ? formatDate(dueAt) : "";
  const today = getLocalDateISO();
  if (status === "DUE_TODAY" || dueDate === today) return "Due Today";
  if (dueDate && dueDate < today) return "Overdue";
  return "Upcoming";
}

function frontendAlertSeverity(severity: BackendNotification["severity"]): ClinicalAlert["severity"] {
  if (severity === "CRITICAL") return "Critical";
  if (severity === "ACTION_REQUIRED" || severity === "REMINDER") return "Warning";
  return "Info";
}

function frontendAlertCategory(category: string): ClinicalAlert["category"] {
  if (category === "Allergy" || category === "Abnormal Report" || category === "Emergency" || category === "Task") {
    return category;
  }
  if (category.toLowerCase().includes("emergency")) return "Emergency";
  if (category.toLowerCase().includes("report")) return "Abnormal Report";
  return "Task";
}

function relativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
}

function numberValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return undefined;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function formatLocalDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDate(value);

  return [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
    .join("-");
}

function formatTime24(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(11, 16);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function ageFromBirthDate(value?: string | null) {
  if (!value) return 0;

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

export async function getBackendBootstrap(options: { ensureDemo?: boolean; workplaceId?: string } = {}) {
  const ensureDemo = options.ensureDemo ? "true" : "false";
  const requestedWorkplace = isUuid(options.workplaceId) ? `&workplaceId=${options.workplaceId}` : "";
  const payload = await requestJson<{ ok: true; data: BackendBootstrapPayload }>(`/api/hms/doctor/bootstrap?ensureDemo=${ensureDemo}${requestedWorkplace}`);
  const clinicWorkplace =
    payload.data.workplaces.find((workplace) => workplace.id === options.workplaceId) ??
    payload.data.workplaces.find((workplace) => workplace.type === "CLINIC") ??
    payload.data.workplaces[0];

  const doctors: Doctor[] = payload.data.doctors.map((doctor) => ({
    id: doctor.id,
    userAccountId: doctor.userAccountId ?? undefined,
    name: doctor.fullName,
    specialty: doctor.specialty,
    qualifications: doctor.qualifications ?? "Not added",
    experienceYears: doctor.experienceYears ?? 0,
    avatarInitials: initials(doctor.fullName),
    availability: "Available",
    workplaceIds: doctor.doctor_workplaces?.map((membership) => membership.workplaceId),
  }));

  const locations: ClinicLocation[] = (clinicWorkplace?.locations ?? clinicWorkplace?.workplace_locations ?? []).map((location) => ({
    id: location.id,
    name: location.name,
    address: `${location.addressLine1}, ${location.city}`,
    isPrimary: location.isPrimary,
  }));
  const latestVitalsByPatient = new Map<string, Vitals>();
  payload.data.vitals.forEach((vitals) => {
    if (!latestVitalsByPatient.has(vitals.patientId)) {
      latestVitalsByPatient.set(vitals.patientId, toFrontendVitals(vitals));
    }
  });

  const patients: Patient[] = payload.data.patients.map((patient) => {
    const patientWorkplaces = patient.workplaces ?? patient.patient_workplaces ?? [];
    const patientAllergies = patient.allergies ?? patient.patient_allergies ?? [];
    const patientConditions = patient.conditions ?? patient.patient_conditions ?? [];
    const workplaceLink = patientWorkplaces.find((item) => item.workplaceId === clinicWorkplace?.id) ?? patientWorkplaces[0];

    return {
      id: patient.id,
      mrn: workplaceLink?.localMrn ?? patient.id.slice(0, 8),
      name: patient.fullName,
      age: ageFromBirthDate(patient.dateOfBirth),
      gender: frontendGender(patient.gender),
      phone: patient.phone ?? "Not added",
      avatarInitials: initials(patient.fullName),
      primaryDoctorId: patient.primaryDoctorId ?? doctors[0]?.id ?? "",
      clinicId: clinicWorkplace?.id,
      workplaceIds: patientWorkplaces.map((item) => item.workplaceId),
      workContexts: patientWorkplaces
        .map((item) => payload.data.workplaces.find((workplace) => workplace.id === item.workplaceId)?.type)
        .filter((type, index, values) => Boolean(type) && values.indexOf(type) === index)
        .map((type) => type === "HOSPITAL" ? "hospital" : "clinic") as WorkContext[],
      bloodGroup: patient.bloodGroup ?? "-",
      allergies: patientAllergies.map((allergy) => ({
        substance: allergy.substance,
        severity: allergy.severity === "SEVERE" ? "Severe" : allergy.severity === "MODERATE" ? "Moderate" : "Mild",
        reaction: allergy.reaction ?? "",
      })),
      conditions: patientConditions.map((condition) => condition.name),
      lastVisit: "Backend",
      latestVitals: latestVitalsByPatient.get(patient.id),
      tags: ["New"],
    };
  });

  const appointments: Appointment[] = payload.data.appointments.map(toFrontendAppointment);
  const workplaces: Workplace[] = payload.data.workplaces.map(toFrontendWorkplace);
  const shifts: DoctorShift[] = payload.data.shifts.map(toFrontendShift);
  const services: BackendClinicServiceRow[] = payload.data.services.map(toFrontendService);
  const diagnoses: DiagnosisEntry[] = payload.data.diagnoses.map(toFrontendDiagnosis);
  const prescriptions: Prescription[] = payload.data.prescriptions.map(toFrontendPrescription);
  const labOrders: LabOrder[] = payload.data.orders.filter((order) => order.type === "LABORATORY").map(toFrontendLabOrder);
  const radiologyOrders: RadiologyOrder[] = payload.data.orders.filter((order) => order.type === "RADIOLOGY").map(toFrontendRadiologyOrder);
  const followUps: FollowUp[] = payload.data.followUps.map((followUp) => {
    const workplace = payload.data.workplaces.find((item) => item.id === followUp.workplaceId);
    return toFrontendFollowUp(followUp, workplace?.type === "HOSPITAL" ? "hospital" : "clinic");
  });
  const staff: StaffMember[] = payload.data.staff.map(toFrontendStaff);
  const alerts: ClinicalAlert[] = payload.data.notifications.map(toFrontendAlert);
  const tasks: DoctorTaskItem[] = payload.data.tasks.map(toFrontendTask);
  const admissions: HospitalWorkItem[] = payload.data.admissions.map(toFrontendAdmission);
  const consultationNotes: ConsultationNote[] = payload.data.encounters.map(toFrontendConsultationNote);

  return {
    currentDoctorId: payload.data.currentDoctorId,
    workplaceId: clinicWorkplace?.id,
    doctors,
    workplaces,
    locations,
    patients,
    appointments,
    shifts,
    services,
    diagnoses,
    prescriptions,
    labOrders,
    radiologyOrders,
    followUps,
    staff,
    alerts,
    tasks,
    admissions,
    consultationNotes,
  };
}

function toFrontendWorkplace(workplace: BackendWorkplace): Workplace {
  const locations = workplace.locations ?? workplace.workplace_locations ?? [];
  const primaryLocation = locations.find((location) => location.isPrimary) ?? locations[0];

  return {
    id: workplace.id,
    name: workplace.name,
    type: frontendWorkplaceType(workplace.type),
    location: primaryLocation?.name ?? primaryLocation?.city,
    role: workplace.type === "HOSPITAL" ? "Visiting Consultant" : "Consulting Physician",
    status: workplace.status === "PENDING" ? "Pending" : workplace.status === "ACTIVE" ? "Active" : "Verified",
    managedBy: workplace.legalName ?? workplace.name,
  };
}

function toFrontendAppointment(appointment: BackendAppointment): Appointment {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    workplaceId: appointment.workplaceId,
    locationId: appointment.locationId ?? undefined,
    workContext: "clinic",
    date: formatLocalDate(appointment.scheduledAt),
    time: formatTime(appointment.scheduledAt),
    durationMins: appointment.durationMinutes,
    type: frontendAppointmentType(appointment.mode),
    status: frontendAppointmentStatus(appointment.status),
    reason: appointment.reason ?? "Consultation",
  };
}

function toFrontendShift(shift: BackendShift): DoctorShift {
  return {
    id: shift.id,
    doctorId: shift.doctorId,
    workplaceId: shift.workplaceId,
    date: formatLocalDate(shift.startsAt),
    startTime: formatTime24(shift.startsAt),
    endTime: formatTime24(shift.endsAt),
    shiftType: frontendShiftType(shift.shiftType),
    status: frontendShiftStatus(shift.status),
    bookingEnabled: shift.bookingEnabled,
    slotMinutes: shift.slotMinutes ?? undefined,
    bufferMinutes: shift.bufferMinutes ?? undefined,
    bookingLimit: shift.bookingLimit ?? undefined,
    recurrenceRule: shift.recurrenceRule ?? undefined,
    note: shift.note ?? undefined,
  };
}

function toFrontendService(service: BackendClinicService): BackendClinicServiceRow {
  return {
    id: service.id,
    name: service.name,
    eligibleDoctorIds: service.eligibleDoctors?.map((doctor) => doctor.doctorId) ?? [],
    durationMinutes: service.durationMinutes,
    price: numberValue(service.price) ?? 0,
  };
}

function toFrontendDiagnosis(diagnosis: BackendDiagnosis): DiagnosisEntry {
  return {
    id: diagnosis.id,
    patientId: diagnosis.patientId,
    icdCode: diagnosis.icdCode ?? "",
    description: diagnosis.description,
    diagnosedOn: formatDate(diagnosis.diagnosedAt),
    status: frontendDiagnosisStatus(diagnosis.status),
    doctorId: diagnosis.encounters?.doctorId ?? "",
    workplaceId: diagnosis.encounters?.workplaceId,
    workContext: "clinic",
  };
}

function toFrontendPrescription(prescription: BackendPrescription): Prescription {
  return {
    id: prescription.id,
    patientId: prescription.patientId,
    doctorId: prescription.doctorId,
    date: formatDate(prescription.issuedAt ?? prescription.createdAt),
    medicines: prescription.medicines.map((medicine) => ({
      id: medicine.id,
      name: medicine.medicineName,
      dosage: medicine.strength ?? medicine.dose ?? "",
      frequency: medicine.frequency ?? "",
      duration: medicine.duration ?? "",
      instructions: medicine.instructions ?? "",
    })),
    advice: prescription.advice ?? "",
    status: frontendPrescriptionStatus(prescription.status),
    workplaceId: prescription.workplaceId,
    workContext: "clinic",
  };
}

function toFrontendLabOrder(order: BackendOrder): LabOrder {
  return {
    id: order.id,
    patientId: order.patientId,
    doctorId: order.doctorId,
    testName: order.title,
    orderedOn: formatDate(order.orderedAt),
    status: frontendOrderStatus(order.status),
    source:
      order.source === "Partner Lab" || order.source === "External / Manual" || order.source === "Internal"
        ? order.source
        : "Internal",
    priority: frontendOrderPriority(order.priority),
    workplaceId: order.workplaceId,
    report: order.reports ?? undefined,
    workContext: "clinic",
  };
}

function toFrontendRadiologyOrder(order: BackendOrder): RadiologyOrder {
  const [rawType, ...regionParts] = order.title.split(" - ");
  const imagingType = (["X-Ray", "CT Scan", "MRI", "Ultrasound"].includes(rawType) ? rawType : "X-Ray") as RadiologyOrder["imagingType"];

  return {
    id: order.id,
    patientId: order.patientId,
    doctorId: order.doctorId,
    imagingType,
    bodyRegion: regionParts.join(" - ") || order.title,
    orderedOn: formatDate(order.orderedAt),
    status: frontendOrderStatus(order.status),
    priority: frontendOrderPriority(order.priority),
    workplaceId: order.workplaceId,
    workContext: "clinic",
  };
}

function toFrontendFollowUp(followUp: BackendFollowUp, workContext: WorkContext = "clinic"): FollowUp {
  return {
    id: followUp.id,
    patientId: followUp.patientId,
    doctorId: followUp.doctorId,
    dueDate: followUp.dueAt ? formatDate(followUp.dueAt) : "",
    reason: followUp.reason,
    status: frontendFollowUpStatus(followUp.status, followUp.dueAt),
    workplaceId: followUp.workplaceId,
    workContext,
  };
}

function toFrontendTask(task: BackendTask): DoctorTaskItem {
  const dueAt = task.dueAt ? new Date(task.dueAt) : undefined;
  const isDue = !dueAt || dueAt.getTime() <= Date.now();
  const status = task.status === "COMPLETED" || task.status === "CANCELLED"
    ? "completed"
    : task.priority === "CRITICAL" || (task.priority === "HIGH" && isDue)
      ? "urgent"
      : isDue
        ? "today"
        : "upcoming";
  return {
    id: task.id,
    appointmentId: task.appointmentId ?? undefined,
    kind: "task",
    title: task.title,
    patientId: task.patientId ?? undefined,
    workplaceId: task.workplaceId ?? "",
    source: task.description?.split(" - ")[0] ?? "Clinical task",
    assignedBy: task.task_assignees?.[0]?.user_accounts?.email ?? "Care team",
    dueTime: dueAt ? formatTime(dueAt.toISOString()) : "No due date",
    priority: task.priority === "CRITICAL" ? "Critical" : task.priority === "HIGH" ? "High" : task.priority === "LOW" ? "Low" : "Medium",
    status,
  };
}

function toFrontendAdmission(admission: BackendAdmission): HospitalWorkItem {
  const diagnosis = admission.encounters?.diagnoses?.[0]?.description ?? admission.encounters?.assessment ?? "Active admission";
  return {
    id: admission.id,
    admissionId: admission.id,
    encounterId: admission.encounterId,
    patientId: admission.patientId,
    workplaceId: admission.workplaceId,
    bed: admission.bed?.code ?? "-",
    diagnosis,
    priority: "Medium",
    reasonAssigned: admission.doctorCleared ? "Doctor clearance completed" : "Active inpatient admission",
    status: admission.doctorCleared ? "completed" : "assigned",
  };
}

function toFrontendConsultationNote(encounter: BackendEncounter): ConsultationNote {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    doctorId: encounter.doctorId,
    date: formatDate(encounter.createdAt),
    chiefComplaint: encounter.chiefComplaint ?? "Consultation",
    symptoms: encounter.history ? encounter.history.split(/\n|,\s*/).map((item) => item.trim()).filter(Boolean) : [],
    observations: encounter.treatmentPlan ?? "",
    diagnosis: encounter.assessment ?? "",
    plan: encounter.treatmentPlan ?? "",
    status: encounter.status === "CONSULTATION_COMPLETED" || encounter.status === "CLOSED" ? "Finalized" : "Draft",
    workContext: "clinic",
  };
}

function toFrontendVitals(vitals: BackendVitalSet): Vitals {
  const systolic = vitals.systolicBp ?? 0;
  const diastolic = vitals.diastolicBp ?? 0;

  return {
    recordedAt: vitals.recordedAt,
    bp: systolic && diastolic ? `${systolic}/${diastolic}` : "-",
    pulse: vitals.pulse ?? 0,
    temp: numberValue(vitals.temperatureF) ?? 0,
    spo2: vitals.spo2 ?? 0,
    weight: numberValue(vitals.weightKg) ?? 0,
    bmi: numberValue(vitals.bmi) ?? 0,
  };
}

function toFrontendStaff(staff: BackendStaff): StaffMember {
  const roleMap: Record<string, StaffMember["role"]> = {
    RECEPTIONIST: "Receptionist",
    NURSE: "Nurse",
    BILLING: "Assistant",
    PHARMACIST: "Lab/Pharmacy User",
    TECHNICIAN: "Lab/Pharmacy User",
    SUPPORT: "Assistant",
  };
  const role = roleMap[staff.role] ?? staff.role as StaffMember["role"];
  const memberships = staff.memberships ?? staff.staff_workplaces ?? [];

  return {
    id: staff.id,
    userAccountId: staff.userAccountId ?? undefined,
    name: staff.fullName,
    role: ["Receptionist", "Nurse", "Assistant", "Lab/Pharmacy User"].includes(role) ? role : "Assistant",
    status: staff.status === "PENDING" ? "Invited" : staff.status === "SUSPENDED" ? "Suspended" : "Active",
    workplaceIds: memberships.map((membership) => membership.workplaceId),
  };
}

function toFrontendAlert(notification: BackendNotification): ClinicalAlert {
  return {
    id: notification.id,
    severity: frontendAlertSeverity(notification.severity),
    category: frontendAlertCategory(notification.category),
    patientId: notification.patientId ?? undefined,
    message: notification.body ?? notification.title,
    time: relativeTime(notification.createdAt),
    acknowledged: Boolean(notification.readAt),
    workContext: "clinic",
  };
}

function toFrontendConversation(conversation: BackendConversation): BackendConversationRow {
  const otherParticipant =
    conversation.participants.find((participant) => participant.isSelf === false) ??
    conversation.participants.find((participant) => !participant.isSelf && participant.participantType !== "Doctor") ??
    conversation.participants.find((participant) => !participant.isSelf);
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  return {
    id: conversation.id,
    withName: otherParticipant?.displayName ?? conversation.title ?? "Conversation",
    withRole:
      otherParticipant?.participantType === "Patient"
        ? "Patient"
        : otherParticipant?.participantType === "Doctor"
          ? "Doctor"
          : otherParticipant?.participantType === "Lab"
            ? "Lab"
            : otherParticipant?.participantType === "Pharmacist"
              ? "Pharmacist"
              : "Clinic Admin",
    lastMessage: lastMessage?.body ?? "No messages yet",
    time: lastMessage ? relativeTime(lastMessage.sentAt) : relativeTime(conversation.updatedAt),
    unread: 0,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      from: message.isMine || (!("isMine" in message) && Boolean(message.senderUserId)) ? "me" : "them",
      text: message.body,
      time: relativeTime(message.sentAt),
    })),
  };
}

export async function createBackendAppointment(input: {
  patientId: string;
  doctorId: string;
  workplaceId: string;
  locationId?: string;
  date: string;
  time: string;
  durationMins: number;
  type: AppointmentType;
  reason: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");
  if (input.locationId) requireUuid(input.locationId, "Location id");

  const payload = await requestJson<{ ok: true; data: BackendAppointment }>("/api/hms/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      locationId: input.locationId,
      scheduledAt: toIsoDateTime(input.date, input.time),
      durationMinutes: input.durationMins,
      mode: appointmentMode(input.type),
      reason: input.reason,
    }),
  });

  return toFrontendAppointment(payload.data);
}

export async function createBackendPatient(input: {
  qlynoId: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  primaryDoctorId?: string;
  workplaceId?: string;
  localMrn?: string;
}) {
  const payload = await requestJson<{ data: BackendPatient }>("/api/hms/patients", {
    method: "POST",
    body: JSON.stringify({
      qlynoId: input.qlynoId,
      fullName: input.fullName,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone || "Not added",
      email: input.email,
      bloodGroup: input.bloodGroup,
      primaryDoctorId: isUuid(input.primaryDoctorId) ? input.primaryDoctorId : undefined,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      localMrn: input.localMrn || input.qlynoId,
    }),
  });
  return toFrontendPatient(payload.data);
}

export async function updateBackendPatient(
  id: string,
  input: {
    fullName?: string;
    gender?: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
    phone?: string;
    bloodGroup?: string;
    primaryDoctorId?: string;
  }
) {
  const payload = await requestJson<{ data: BackendPatient }>(`/api/hms/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fullName: input.fullName,
      gender: input.gender,
      phone: input.phone || undefined,
      bloodGroup: input.bloodGroup,
      primaryDoctorId: isUuid(input.primaryDoctorId) ? input.primaryDoctorId : undefined,
    }),
  });
  return toFrontendPatient(payload.data);
}

export async function deleteBackendPatient(id: string) {
  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/patients/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ workplaceId: bootstrap.workplaceId }),
  });
}

export async function updateBackendAppointmentStatus(id: string, status: AppointmentStatus, workplaceId?: string) {
  requireUuid(id, "Appointment id");

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: appointmentStatus(status), workplaceId: isUuid(workplaceId) ? workplaceId : bootstrap.workplaceId }),
  });
}

export async function updateBackendAppointment(
  id: string,
  input: {
    patientId: string;
    doctorId: string;
    workplaceId: string;
    locationId?: string;
    date: string;
    time: string;
    durationMins: number;
    type: AppointmentType;
    reason: string;
  }
) {
  requireUuid(id, "Appointment id");
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");
  if (input.locationId) requireUuid(input.locationId, "Location id");

  const payload = await requestJson<{ ok: true; data: BackendAppointment }>(`/api/hms/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      locationId: input.locationId,
      scheduledAt: toIsoDateTime(input.date, input.time),
      durationMinutes: input.durationMins,
      mode: appointmentMode(input.type),
      reason: input.reason,
    }),
  });

  return toFrontendAppointment(payload.data);
}

export async function deleteBackendAppointment(id: string) {
  requireUuid(id, "Appointment id");

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/appointments/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ workplaceId: bootstrap.workplaceId }),
  });
}

export async function createBackendShift(input: {
  doctorId: string;
  workplaceId: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  bookingEnabled?: boolean;
  slotMinutes?: number;
  bufferMinutes?: number;
  bookingLimit?: number;
  recurrenceRule?: string;
  note?: string;
}) {
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendShift }>("/api/hms/shifts", {
    method: "POST",
    body: JSON.stringify({
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      startsAt: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
      endsAt: new Date(`${input.date}T${input.endTime}:00`).toISOString(),
      shiftType: input.shiftType.toUpperCase(),
      bookingEnabled: input.bookingEnabled ?? true,
      slotMinutes: input.slotMinutes ?? 20,
      bufferMinutes: input.bufferMinutes ?? 0,
      bookingLimit: input.bookingLimit,
      recurrenceRule: input.recurrenceRule,
      note: input.note,
    }),
  });

  return toFrontendShift(payload.data);
}

export async function updateBackendShiftStatus(id: string, status: string, workplaceId?: string) {
  requireUuid(id, "Shift id");

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/shifts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: status.toUpperCase(), workplaceId: isUuid(workplaceId) ? workplaceId : bootstrap.workplaceId }),
  });
}

export async function createBackendPrescription(input: {
  patientId: string;
  doctorId: string;
  workplaceId: string;
  advice?: string;
  medicines: Medicine[];
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");
  const advice = input.advice?.trim() || undefined;
  const medicines = input.medicines.map((medicine) => ({
    medicineName: medicine.name.trim(),
    strength: medicine.dosage.trim() || undefined,
    dose: medicine.dosage.trim(),
    frequency: medicine.frequency.trim(),
    duration: medicine.duration.trim(),
    instructions: medicine.instructions.trim() || undefined,
    quantity: 1,
  }));

  const payload = await requestJson<{ ok: true; data: BackendPrescription }>("/api/hms/prescriptions", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      ...(advice ? { advice } : {}),
      medicines,
    }),
  });

  return toFrontendPrescription(payload.data);
}

export async function createBackendOrder(input: {
  patientId: string;
  doctorId: string;
  workplaceId: string;
  type: "LABORATORY" | "RADIOLOGY";
  title: string;
  priority: "Routine" | "Urgent";
  source?: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendOrder }>("/api/hms/investigations", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      type: input.type,
      title: input.title,
      priority: input.priority === "Urgent" ? "URGENT" : "ROUTINE",
      source: input.source,
      encounterId: undefined,
    }),
  });

  return payload.data;
}

export async function createBackendClinicService(input: {
  workplaceId: string;
  name: string;
  durationMinutes: number;
  price: number;
  eligibleDoctorIds: string[];
}) {
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendClinicService }>("/api/hms/services", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      eligibleDoctorIds: input.eligibleDoctorIds.filter(isUuid),
    }),
  });

  return toFrontendService(payload.data);
}

export async function updateBackendClinicService(
  id: string,
  input: {
    name: string;
    durationMinutes: number;
    price: number;
    eligibleDoctorIds: string[];
  }
) {
  requireUuid(id, "Service id");

  const payload = await requestJson<{ ok: true; data: BackendClinicService }>(`/api/hms/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      eligibleDoctorIds: input.eligibleDoctorIds.filter(isUuid),
    }),
  });

  return toFrontendService(payload.data);
}

export async function deleteBackendClinicService(id: string) {
  requireUuid(id, "Service id");

  return requestJson(`/api/hms/services/${id}`, {
    method: "DELETE",
  });
}

export async function createBackendDiagnosis(input: {
  patientId: string;
  workplaceId: string;
  icdCode?: string;
  description: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendDiagnosis }>("/api/hms/diagnoses", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      status: "ACTIVE",
      type: "PROVISIONAL",
    }),
  });

  return toFrontendDiagnosis(payload.data);
}

export async function createBackendFollowUp(input: {
  patientId: string;
  doctorId: string;
  workplaceId: string;
  dueDate: string;
  reason: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendFollowUp }>("/api/hms/follow-ups", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      dueAt: `${input.dueDate}T00:00:00.000Z`,
      reason: input.reason,
    }),
  });

  return toFrontendFollowUp(payload.data);
}

export async function updateBackendFollowUpStatus(id: string, status: FollowUp["status"], workplaceId?: string) {
  requireUuid(id, "Follow-up id");

  const map: Record<FollowUp["status"], string> = {
    Upcoming: "UPCOMING",
    "Due Today": "DUE_TODAY",
    Overdue: "OVERDUE",
    Completed: "COMPLETED",
  };

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/follow-ups/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: map[status], workplaceId: isUuid(workplaceId) ? workplaceId : bootstrap.workplaceId }),
  });
}

export async function acknowledgeBackendAlert(id: string) {
  requireUuid(id, "Alert id");
  const bootstrap = await getBackendBootstrap();

  return requestJson(`/api/hms/notifications/${id}/read`, {
    method: "POST",
    body: JSON.stringify({ workplaceId: bootstrap.workplaceId }),
  });
}

export async function getBackendConversations(workplaceId?: string) {
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";
  const payload = await requestJson<{ ok: true; data: BackendConversation[] }>(`/api/hms/conversations${query}`);
  return payload.data.map(toFrontendConversation);
}

export async function sendBackendMessage(input: {
  conversationId?: string;
  workplaceId?: string;
  recipientUserAccountId?: string;
  title?: string;
  body: string;
}) {
  const payload = await requestJson<{
    ok: true;
    data: { conversationId: string; message: { id: string; body: string; sentAt: string } };
  }>("/api/hms/doctor/messages", {
    method: "POST",
    body: JSON.stringify({
      conversationId: isUuid(input.conversationId) ? input.conversationId : undefined,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      recipientUserAccountId: isUuid(input.recipientUserAccountId) ? input.recipientUserAccountId : undefined,
      title: input.title,
      body: input.body,
    }),
  });

  return {
    conversationId: payload.data.conversationId,
    message: {
      id: payload.data.message.id,
      from: "me" as const,
      text: payload.data.message.body,
      time: relativeTime(payload.data.message.sentAt),
    },
  };
}

export async function saveBackendState(scope: string, entityId: string, value: unknown, workplaceId?: string) {
  return requestJson("/api/hms/doctor/state", {
    method: "POST",
    body: JSON.stringify({ scope, entityId, value, workplaceId: isUuid(workplaceId) ? workplaceId : undefined }),
  });
}

export async function getBackendState<T>(scope: string, entityId: string, workplaceId?: string): Promise<T | null> {
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";
  const payload = await requestJson<{ ok: true; data: { value?: T } | null }>(
    `/api/hms/doctor/state/${encodeURIComponent(scope)}/${encodeURIComponent(entityId)}${query}`
  );

  return payload.data?.value ?? null;
}

export async function updateBackendTaskStatus(id: string, workplaceId: string, status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  requireUuid(id, "Task id");
  requireUuid(workplaceId, "Workplace id");
  return requestJson(`/api/hms/doctor/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ workplaceId, status }),
  });
}

export async function completeBackendAdmission(admissionId: string, workplaceId: string, dischargeSummary: string) {
  requireUuid(admissionId, "Admission id");
  requireUuid(workplaceId, "Workplace id");
  const payload = await requestJson<{ data: BackendAdmission }>(`/api/hms/admissions/${admissionId}/doctor-clearance`, {
    method: "POST",
    body: JSON.stringify({ workplaceId, dischargeSummary }),
  });
  return payload.data;
}

export type ReceptionistGender = "Male" | "Female" | "Other";
export type ReceptionistPatientStatus = "Active" | "Deactivated" | "Discharged" | "New";
export type ReceptionistAppointmentStatus = "Confirmed" | "Pending" | "Cancelled" | "Completed";
export type ReceptionistQueueStatus = "Waiting" | "In Consultation" | "Completed";
export type ReceptionistVisitorStatus = "Checked In" | "Checked Out";
export type ReceptionistAdmissionStatus = "Admitted" | "Awaiting Bed" | "Discharged";
export type ReceptionistNotificationChannel = "SMS" | "Email" | "System" | "Call";
export type ReceptionistContextType = "solo-doctor" | "clinic" | "hospital";

export interface BackendReceptionistDoctor {
  name: string;
  department: string;
  backendId?: string;
}

export interface BackendReceptionistPatient {
  uhid: string;
  backendId?: string;
  primaryDoctorId?: string;
  workplaceId?: string;
  name: string;
  age: number;
  gender: ReceptionistGender;
  phone: string;
  department: string;
  bloodGroup?: string;
  lastVisit: string;
  status: ReceptionistPatientStatus;
}

export interface BackendReceptionistPatientDetails {
  id: string;
  uhid: string;
  name: string;
  age: number;
  dateOfBirth: string | null;
  gender: ReceptionistGender;
  phone: string;
  email: string;
  bloodGroup: string;
  department: string;
  address: string;
  notes: string;
  workplaceId: string;
  status: "Active" | "Deactivated";
  createdAt: string;
  updatedAt: string;
}

export interface BackendReceptionistAppointment {
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
  status: ReceptionistAppointmentStatus;
}

export interface BackendReceptionistAppointmentSlip {
  id: string;
  patientId: string;
  doctorId: string;
  workplaceId: string;
  organizationName: string;
  patient: {
    id: string;
    name: string;
    uhid: string;
    age: number;
    gender: ReceptionistGender;
    phone: string;
  };
  doctor: {
    id: string;
    name: string;
    department: string;
  };
  date: string;
  time: string;
  scheduledAt: string;
  status: string;
  mode: string;
  reason?: string | null;
  checkedInAt?: string | null;
  generatedAt: string;
}

export interface BackendReceptionistQueueEntry {
  token: string;
  appointmentId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  patient: string;
  doctor: string;
  department: string;
  checkedInAt: string;
  status: ReceptionistQueueStatus;
}

export interface BackendReceptionistVisitor {
  id: string;
  patientId?: string;
  name: string;
  visiting: string;
  ward: string;
  relation: string;
  passIssued: string;
  status: ReceptionistVisitorStatus;
}

export interface BackendReceptionistAdmission {
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
  status: ReceptionistAdmissionStatus;
}

export interface BackendReceptionistEmergencyCase {
  id: string;
  backendId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  name: string;
  age: string;
  severity: "Critical" | "Serious" | "Stable";
  doctor: string;
  arrivedAt: string;
}

export interface BackendReceptionistBillingRow {
  id: string;
  backendId?: string;
  patientId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  item: string;
  amount: number;
  status: "Paid" | "Pending" | "Advance received";
}

export interface BackendReceptionistNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  channel: ReceptionistNotificationChannel;
  recipient?: string;
}

export interface BackendReceptionistContext {
  type: ReceptionistContextType;
  label: string;
  organizationName: string;
  workplaceId: string;
  timeZone: string;
  ownerLabel: string;
  scopeLabel: string;
  allowedModules: string[];
  permissions: Record<string, boolean>;
  boundaries: string[];
}

export interface BackendReceptionistSettings {
  profile?: {
    displayName: string;
    counterNumber: string;
    defaultDepartmentView: string;
  } | null;
  printers?: {
    tokenPrinter: string;
    visitorPassPrinter: string;
    testPrint?: boolean;
  } | null;
  security?: {
    sessionTimeoutMinutes: number;
    signOutAllSessions?: boolean;
  } | null;
  notificationPreferences?: Record<string, boolean> | null;
  savedAt?: string;
}

export interface BackendReceptionistFollowUp {
  id: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  doctor: string;
  dueAt: string;
  reason: string;
  status: string;
  owner: string;
}

export interface BackendReceptionistTask {
  id: string;
  patientId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  priority: string;
}

export interface BackendReceptionistCoordinationRow {
  id: string;
  patientId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  owner: string;
  type: string;
  title: string;
  status: string;
  date: string;
  boundary: string;
}

export interface BackendReceptionistDocument {
  id: string;
  patientId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  title: string;
  category: string;
  uploadedAt: string;
  status: string;
}

export interface BackendReceptionistAuditTrail {
  id: string;
  action: string;
  detail: string;
  actor: string;
  time: string;
  workplaceId?: string;
}

export interface BackendReceptionistPayload {
  workplaceId?: string;
  settings?: BackendReceptionistSettings | null;
  context: BackendReceptionistContext;
  doctors: BackendReceptionistDoctor[];
  wards: string[];
  patients: BackendReceptionistPatient[];
  appointments: BackendReceptionistAppointment[];
  queue: BackendReceptionistQueueEntry[];
  visitors: BackendReceptionistVisitor[];
  admissions: BackendReceptionistAdmission[];
  emergencyCases: BackendReceptionistEmergencyCase[];
  billingRows: BackendReceptionistBillingRow[];
  notifications: BackendReceptionistNotification[];
  followUps: BackendReceptionistFollowUp[];
  tasks: BackendReceptionistTask[];
  coordination: BackendReceptionistCoordinationRow[];
  documents: BackendReceptionistDocument[];
  auditTrail: BackendReceptionistAuditTrail[];
}

function receptionistBackendGender(gender: ReceptionistGender) {
  if (gender === "Female") return "FEMALE";
  if (gender === "Male") return "MALE";
  return "OTHER";
}

function receptionistBackendAppointmentStatus(status: ReceptionistAppointmentStatus | ReceptionistQueueStatus) {
  const map: Record<string, string> = {
    Confirmed: "CONFIRMED",
    Pending: "SCHEDULED",
    Cancelled: "CANCELLED",
    Completed: "COMPLETED",
    Waiting: "WAITING",
    "In Consultation": "IN_CONSULTATION",
  };
  return map[status] ?? "CONFIRMED";
}

function receptionistBackendNotificationChannel(channel: ReceptionistNotificationChannel) {
  if (channel === "Email") return "EMAIL";
  return channel.toUpperCase();
}

export async function getBackendReceptionistBootstrap(workplaceId?: string) {
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";
  const payload = await requestJson<{ data: BackendReceptionistPayload }>(`/api/hms/receptionist/bootstrap${query}`);
  return payload.data;
}

export async function getBackendReceptionistAppointmentSlip(id: string, workplaceId?: string) {
  requireUuid(id, "Appointment id");
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";
  const payload = await requestJson<{ data: BackendReceptionistAppointmentSlip }>(
    `/api/hms/receptionist/appointments/${id}/slip${query}`
  );
  return payload.data;
}

export async function createBackendReceptionistPatient(input: {
  qlynoId: string;
  fullName: string;
  gender: ReceptionistGender;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  primaryDoctorId?: string;
  workplaceId?: string;
  localMrn: string;
  department?: string;
  address?: string;
  notes?: string;
}) {
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/patients", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      gender: receptionistBackendGender(input.gender),
      primaryDoctorId: isUuid(input.primaryDoctorId) ? input.primaryDoctorId : undefined,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function getBackendReceptionistPatientDetails(id: string, workplaceId?: string) {
  requireUuid(id, "Patient id");
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";
  const payload = await requestJson<{ data: BackendReceptionistPatientDetails }>(
    `/api/hms/receptionist/patients/${id}${query}`
  );
  return payload.data;
}

export async function updateBackendReceptionistPatient(
  id: string,
  input: {
    workplaceId?: string;
    fullName: string;
    gender: ReceptionistGender;
    dateOfBirth?: string | null;
    phone: string;
    email?: string;
    bloodGroup?: string;
    department?: string;
    address?: string;
    notes?: string;
  }
) {
  requireUuid(id, "Patient id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>(`/api/hms/receptionist/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      gender: receptionistBackendGender(input.gender),
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      email: input.email || "",
      bloodGroup: input.bloodGroup || undefined,
      department: input.department || undefined,
      address: input.address ?? "",
      notes: input.notes ?? "",
    }),
  });
  return payload.data;
}

export async function deactivateBackendReceptionistPatient(id: string, workplaceId?: string) {
  requireUuid(id, "Patient id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>(`/api/hms/receptionist/patients/${id}/deactivate`, {
    method: "POST",
    body: JSON.stringify({ workplaceId: isUuid(workplaceId) ? workplaceId : undefined }),
  });
  return payload.data;
}

export async function createBackendReceptionistAppointment(input: {
  patientId: string;
  doctorId: string;
  workplaceId?: string;
  date: string;
  time: string;
  durationMins: number;
  type: AppointmentType;
  reason?: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/appointments", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      scheduledAt: toIsoDateTime(input.date, input.time),
      durationMinutes: input.durationMins,
      mode: appointmentMode(input.type),
      reason: input.reason,
    }),
  });
  return payload.data;
}

export async function updateBackendReceptionistAppointmentStatus(
  id: string,
  status: ReceptionistAppointmentStatus | ReceptionistQueueStatus,
  workplaceId?: string
) {
  requireUuid(id, "Appointment id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>(`/api/hms/receptionist/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: receptionistBackendAppointmentStatus(status),
      workplaceId: isUuid(workplaceId) ? workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function createBackendReceptionistCheckIn(input: {
  patientId: string;
  doctorId: string;
  workplaceId?: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/check-ins", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function createBackendReceptionistVisitor(input: {
  patientId: string;
  workplaceId?: string;
  name: string;
  relation: string;
  ward: string;
  phone?: string;
}) {
  requireUuid(input.patientId, "Patient id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/visitors", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      name: input.name,
      phone: input.phone ?? "Not recorded",
      purpose: `${input.relation} - ${input.ward}`,
    }),
  });
  return payload.data;
}

export async function checkOutBackendReceptionistVisitor(id: string, workplaceId?: string) {
  requireUuid(id, "Visitor id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>(`/api/hms/receptionist/visitors/${id}/check-out`, {
    method: "POST",
    body: JSON.stringify({ workplaceId: isUuid(workplaceId) ? workplaceId : undefined }),
  });
  return payload.data;
}

export async function createBackendReceptionistAdmission(input: {
  patientId: string;
  doctorId: string;
  workplaceId?: string;
  ward: string;
  bed: string;
  admittedAt: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/admissions", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      ward: input.ward,
      bed: input.bed,
      admittedAt: `${input.admittedAt}T00:00:00.000Z`,
    }),
  });
  return payload.data;
}

export async function createBackendReceptionistEmergencyCase(input: {
  name: string;
  age?: string;
  severity: "Critical" | "Serious" | "Stable";
  doctorId: string;
  workplaceId?: string;
  complaint?: string;
}) {
  requireUuid(input.doctorId, "Doctor id");
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/emergency-cases", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      age: input.age ? Number(input.age) : undefined,
      severity: input.severity,
      doctorId: input.doctorId,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
      complaint: input.complaint,
    }),
  });
  return payload.data;
}

export async function createBackendReceptionistNotification(input: {
  channel: ReceptionistNotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  workplaceId?: string;
}) {
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/notifications", {
    method: "POST",
    body: JSON.stringify({
      channel: receptionistBackendNotificationChannel(input.channel),
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function createBackendReceptionistAction(input: {
  action: "PATIENT_CALLED" | "OPD_STATUS_UPDATED" | "CONSULTATION_SLIP_PRINTED" | "TOKEN_SLIP_PRINTED" | "VISITOR_PASS_PRINTED" | "PROFILE_SAVED" | "PRINTER_TESTED";
  subject: string;
  detail: string;
  workplaceId?: string;
  relatedType?: string;
  relatedId?: string;
}) {
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/actions", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function generateBackendReceptionistReport(input: {
  type: "Patient registrations" | "Appointments" | "Admissions" | "Cancellations" | "Overall reception activity";
  range: "Today" | "This week" | "This month" | "Custom range";
  startDate: string;
  endDate: string;
  workplaceId?: string;
}) {
  const payload = await requestJson<{ data: BackendReceptionistPayload; report: Record<string, number> }>("/api/hms/receptionist/reports", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      startDate: `${input.startDate}T00:00:00.000Z`,
      endDate: `${input.endDate}T00:00:00.000Z`,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload;
}

export async function saveBackendReceptionistSettings(input: BackendReceptionistSettings & { workplaceId?: string }) {
  const payload = await requestJson<{ data: BackendReceptionistPayload }>("/api/hms/receptionist/settings", {
    method: "POST",
    body: JSON.stringify({
      profile: input.profile ?? undefined,
      printers: input.printers ?? undefined,
      security: input.security ?? undefined,
      notificationPreferences: input.notificationPreferences ?? undefined,
      workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
    }),
  });
  return payload.data;
}

export async function createBackendVitals(input: {
  patientId: string;
  workplaceId: string;
  bp: string;
  pulse: number;
  temp?: number;
  spo2?: number;
  weight?: number;
  bmi?: number;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.workplaceId, "Workplace id");
  const [systolic, diastolic] = input.bp.split("/").map((part) => Number(part.trim()));

  const payload = await requestJson<{ ok: true; data: BackendVitalSet }>("/api/hms/vitals", {
    method: "POST",
    body: JSON.stringify({
      patientId: input.patientId,
      workplaceId: input.workplaceId,
      systolicBp: Number.isFinite(systolic) ? systolic : undefined,
      diastolicBp: Number.isFinite(diastolic) ? diastolic : undefined,
      pulse: input.pulse,
      temperatureF: input.temp,
      spo2: input.spo2,
      weightKg: input.weight,
      bmi: input.bmi,
    }),
  });

  return toFrontendVitals(payload.data);
}

export async function createBackendClinicLocation(input: {
  workplaceId: string;
  name: string;
  address: string;
}) {
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendLocation }>("/api/hms/locations", {
    method: "POST",
    body: JSON.stringify({
      workplaceId: input.workplaceId,
      name: input.name,
      addressLine1: input.address,
      city: "",
    }),
  });

  return {
    id: payload.data.id,
    name: payload.data.name,
    address: `${payload.data.addressLine1}${payload.data.city ? `, ${payload.data.city}` : ""}`,
    isPrimary: payload.data.isPrimary,
  } satisfies ClinicLocation;
}

export async function updateBackendClinicLocation(
  id: string,
  input: {
    name: string;
    address: string;
    isPrimary?: boolean;
  }
) {
  requireUuid(id, "Location id");

  const payload = await requestJson<{ ok: true; data: BackendLocation }>(`/api/hms/locations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name,
      addressLine1: input.address,
      city: "",
      isPrimary: input.isPrimary,
    }),
  });

  return {
    id: payload.data.id,
    name: payload.data.name,
    address: `${payload.data.addressLine1}${payload.data.city ? `, ${payload.data.city}` : ""}`,
    isPrimary: payload.data.isPrimary,
  } satisfies ClinicLocation;
}

export async function deleteBackendClinicLocation(id: string) {
  requireUuid(id, "Location id");

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/locations/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ workplaceId: bootstrap.workplaceId }),
  });
}

export async function createBackendClinicDoctor(input: {
  workplaceId?: string;
  fullName: string;
  specialty: string;
  qualifications?: string;
  experienceYears?: number;
}) {
  const body = {
    ...input,
    workplaceId: isUuid(input.workplaceId) ? input.workplaceId : undefined,
  };

  const payload = await requestJson<{ ok: true; data: BackendDoctor }>("/api/hms/doctors", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: payload.data.id,
    name: payload.data.fullName,
    specialty: payload.data.specialty,
    qualifications: payload.data.qualifications ?? "Verification pending",
    experienceYears: payload.data.experienceYears ?? 0,
    avatarInitials: initials(payload.data.fullName),
    availability: "Off",
  } satisfies Doctor;
}

export async function updateBackendClinicDoctor(
  id: string,
  input: {
    fullName: string;
    specialty: string;
    qualifications?: string;
    experienceYears?: number;
  }
) {
  requireUuid(id, "Doctor id");

  const payload = await requestJson<{ ok: true; data: BackendDoctor }>(`/api/hms/doctors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return {
    id: payload.data.id,
    name: payload.data.fullName,
    specialty: payload.data.specialty,
    qualifications: payload.data.qualifications ?? "Verification pending",
    experienceYears: payload.data.experienceYears ?? 0,
    avatarInitials: initials(payload.data.fullName),
    availability: "Off",
  } satisfies Doctor;
}

export async function deleteBackendClinicDoctor(id: string, workplaceId?: string) {
  requireUuid(id, "Doctor id");
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/doctors/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ workplaceId: isUuid(workplaceId) ? workplaceId : bootstrap.workplaceId }),
  });
}

export async function createBackendClinicStaff(input: {
  workplaceId: string;
  fullName: string;
  role: StaffMember["role"];
}) {
  requireUuid(input.workplaceId, "Workplace id");

  const payload = await requestJson<{ ok: true; data: BackendStaff }>("/api/hms/staff", {
    method: "POST",
    body: JSON.stringify({
      workplaceId: input.workplaceId,
      fullName: input.fullName,
      role: input.role,
    }),
  });

  return toFrontendStaff(payload.data);
}

export async function updateBackendClinicStaff(
  id: string,
  input: {
    fullName: string;
    role: StaffMember["role"];
    status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "ARCHIVED";
  }
) {
  requireUuid(id, "Staff id");

  const payload = await requestJson<{ ok: true; data: BackendStaff }>(`/api/hms/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return toFrontendStaff(payload.data);
}

export async function deleteBackendClinicStaff(id: string, workplaceId?: string) {
  requireUuid(id, "Staff id");
  const query = isUuid(workplaceId) ? `?workplaceId=${workplaceId}` : "";

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/staff/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ workplaceId: isUuid(workplaceId) ? workplaceId : bootstrap.workplaceId }),
  });
}

export async function updateBackendOrderStatus(id: string, status: OrderStatus) {
  requireUuid(id, "Order id");

  const bootstrap = await getBackendBootstrap();
  return requestJson(`/api/hms/investigations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: orderStatus(status), workplaceId: bootstrap.workplaceId }),
  });
}

export async function completeBackendEncounter(input: {
  patientId: string;
  doctorId: string;
  workplaceId: string;
  appointmentId?: string;
  encounterId?: string;
  workContext: WorkContext;
  complete?: boolean;
  chiefComplaint?: string;
  symptoms?: string;
  examination?: string;
  vitals?: string;
  diagnosis?: string;
  icdCode?: string;
  treatmentPlan?: string;
  notes?: string;
  prescription?: string;
  labOrder?: string;
  radiologyOrder?: string;
  followUp?: string;
}) {
  requireUuid(input.patientId, "Patient id");
  requireUuid(input.doctorId, "Doctor id");
  requireUuid(input.workplaceId, "Workplace id");
  if (input.appointmentId) requireUuid(input.appointmentId, "Appointment id");

  const body = {
      patientId: input.patientId,
      doctorId: input.doctorId,
      workplaceId: input.workplaceId,
      appointmentId: input.appointmentId,
      complete: input.complete ?? true,
      type: input.workContext === "hospital" ? "INPATIENT_ROUND" : "NEW_CONSULTATION",
      chiefComplaint: input.chiefComplaint,
      history: input.symptoms,
      examination: input.examination,
      clinicalNotes: input.notes,
      assessment: input.diagnosis,
      treatmentPlan: input.treatmentPlan,
      diagnoses: input.diagnosis
        ? [{ description: input.diagnosis, icdCode: input.icdCode || undefined, type: "PRIMARY", status: "ACTIVE" }]
        : [],
      prescription: input.prescription
        ? {
            advice: input.prescription,
            status: "ACTIVE",
            medicines: [{ medicineName: input.prescription }],
          }
        : undefined,
      orders: [
        ...(input.labOrder ? [{ type: "LABORATORY", title: input.labOrder, priority: "ROUTINE" }] : []),
        ...(input.radiologyOrder ? [{ type: "RADIOLOGY", title: input.radiologyOrder, priority: "ROUTINE" }] : []),
      ],
      followUp: input.followUp ? { reason: input.followUp } : undefined,
  };

  if (input.encounterId) {
    const payload = await requestJson<{ data: { id: string } }>(`/api/hms/encounters/${input.encounterId}`, {
      method: "PATCH",
      body: JSON.stringify({
        workplaceId: input.workplaceId,
        history: body.history,
        examination: body.examination,
        clinicalNotes: body.clinicalNotes,
        assessment: body.assessment,
        treatmentPlan: body.treatmentPlan,
        complete: input.complete ?? true,
      }),
    });
    return payload.data;
  }

  const payload = await requestJson<{ data: { id: string } }>("/api/hms/encounters", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return payload.data;
}
