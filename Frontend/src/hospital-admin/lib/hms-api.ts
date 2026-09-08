"use client";

import type {
  Ambulance,
  AmbulanceStatus,
  AmbulanceType,
  CrewMember,
  DispatchRecord,
  DispatchStatus,
  TelemetryData,
} from "@/hospital-admin/store/slices/ambulanceSlice";
import type { EmergencyCase, EmergencyPriority, EmergencyStatus, EmergencyState } from "@/hospital-admin/store/slices/emergencySlice";
import type { SurgicalCase, SurgicalCaseStatus, SurgeryHistoryRecord, SurgicalState } from "@/hospital-admin/store/slices/surgicalSlice";
import type { WardsBedsState } from "@/hospital-admin/store/slices/wardsBedsSlice";
import type { ContentResourcesState } from "@/hospital-admin/store/slices/contentResourcesSlice";
import type { DocumentsState } from "@/hospital-admin/store/slices/documentsSlice";
import type { PatientReviewsState } from "@/hospital-admin/store/slices/patientReviewsSlice";
import type {
  ArticleItem,
  Bed,
  BedStatus,
  BedTier,
  ContentStatus,
  PatientEducationItem,
  Ward,
  WardType,
} from "@/hospital-admin/lib/types";
import type { HospitalDocumentItem } from "@/hospital-admin/lib/types/documents";
import type { HospitalProfileState } from "@/hospital-admin/lib/types/hospital-profile";
import type { PatientReviewItem, ReviewAnalyticsSummary, ReviewSentiment } from "@/hospital-admin/lib/types/patient-reviews";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const AUTH_KEY = "qlyno.hms.auth.v1";
const WORKPLACE_KEY = "qlyno.hms.workplaceId";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HmsAuthSession = {
  accessToken: string;
  user?: {
    userId: string;
    name?: string | null;
    email?: string | null;
    roles?: string[];
    permissions?: string[];
  };
};

type HmsEnvelope<T> = { data: T };

export function getHmsAuthSession(): HmsAuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY) ?? window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HmsAuthSession;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function persistHmsAuthSession(session: HmsAuthSession, remember = true) {
  if (typeof window === "undefined") return;
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_KEY, JSON.stringify(session));
  (remember ? window.sessionStorage : window.localStorage).removeItem(AUTH_KEY);
}

export function clearHmsAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.sessionStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(WORKPLACE_KEY);
  window.sessionStorage.removeItem(WORKPLACE_KEY);
}

async function hmsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getHmsAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
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

export async function loginHms(input: { identifier: string; password: string; tenantSlug?: string; remember?: boolean }) {
  const payload = await hmsRequest<{ accessToken: string; user: HmsAuthSession["user"] }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      identifier: input.identifier,
      password: input.password,
      tenantSlug: input.tenantSlug ?? "sunrise-hospital",
    }),
  });
  persistHmsAuthSession({ accessToken: payload.accessToken, user: payload.user }, input.remember ?? true);
  return payload;
}

type BackendWorkplace = {
  id: string;
  name: string;
  legalName?: string | null;
  type: string;
  workplace_locations?: Array<{
    name?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    isPrimary?: boolean | null;
  }>;
};

export async function getHmsWorkplaceId() {
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(WORKPLACE_KEY) ?? window.sessionStorage.getItem(WORKPLACE_KEY);
    if (cached) return cached;
  }

  const payload = await hmsRequest<HmsEnvelope<BackendWorkplace[]>>("/api/hms/workplaces");
  const workplace = payload.data.find((item) => item.type === "HOSPITAL") ?? payload.data[0];
  if (!workplace) throw new Error("No hospital workplace is available for this user.");

  if (typeof window !== "undefined") window.localStorage.setItem(WORKPLACE_KEY, workplace.id);
  return workplace.id;
}

function iso(value?: string | null) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function displayDateTime(value?: string | null) {
  return iso(value).replace("T", " ").substring(0, 16);
}

function tailId(id: string) {
  return id.slice(-6).toUpperCase();
}

function toFrontendWardType(type: string): WardType {
  const map: Record<string, WardType> = {
    GENERAL: "General",
    ICU: "ICU",
    ISOLATION: "Isolation",
    MATERNITY: "Maternity",
    PEDIATRIC: "NICU",
    PRIVATE: "Private",
  };
  return map[type] ?? "General";
}

function toFrontendBedStatus(status: string): BedStatus {
  const map: Record<string, BedStatus> = {
    AVAILABLE: "Available",
    OCCUPIED: "Occupied",
    RESERVED: "Reserved",
    CLEANING: "Cleaning",
    MAINTENANCE: "Maintenance",
    DECOMMISSIONED: "Decommissioned",
  };
  return map[status] ?? "Available";
}

function toFrontendBedTier(wardType: string): BedTier {
  const map: Record<string, BedTier> = {
    GENERAL: "General",
    ICU: "ICU",
    ISOLATION: "Isolation",
    MATERNITY: "Private Suite",
    PEDIATRIC: "NICU",
    PRIVATE: "Private Suite",
  };
  return map[wardType] ?? "General";
}

type BackendWard = {
  id: string;
  name: string;
  type: string;
  beds?: BackendBed[];
};

type BackendBed = {
  id: string;
  wardId: string;
  code: string;
  status: string;
  dailyRate?: string | number | null;
  ward?: BackendWard;
};

type BackendAdmission = {
  id: string;
  patientId: string;
  bedId: string;
  status: string;
  admittedAt: string;
  dischargedAt?: string | null;
};

function toFrontendBed(row: BackendBed, admissions: BackendAdmission[] = []): Bed {
  const ward = row.ward;
  const activeAdmission = admissions.find((admission) => admission.bedId === row.id && admission.status === "ADMITTED");
  const status = toFrontendBedStatus(row.status);
  return {
    id: row.id,
    wardId: row.wardId,
    wardName: ward?.name ?? "Hospital Ward",
    bedNumber: row.code,
    tier: toFrontendBedTier(ward?.type ?? "GENERAL"),
    status,
    floor: "Hospital Floor",
    currentPatientId: activeAdmission?.patientId,
    currentPatientName: activeAdmission ? `Patient ${tailId(activeAdmission.patientId)}` : undefined,
    admissionDate: activeAdmission?.admittedAt ? iso(activeAdmission.admittedAt).split("T")[0] : undefined,
    lengthOfStayDays: activeAdmission?.admittedAt
      ? Math.max(1, Math.ceil((Date.now() - new Date(activeAdmission.admittedAt).getTime()) / 86_400_000))
      : undefined,
    attachedEquipment: status === "Occupied" ? ["Vitals Monitor"] : [],
    nurseToPatientRatio: ward?.type === "ICU" ? "1:1" : "1:4",
    turnoverETA: status === "Cleaning" ? "25 mins" : undefined,
  };
}

function toFrontendWard(row: BackendWard, beds: BackendBed[]): Ward {
  const wardBeds = beds.filter((bed) => bed.wardId === row.id);
  return {
    id: row.id,
    name: row.name,
    type: toFrontendWardType(row.type),
    floor: "Hospital Floor",
    department: row.type === "ICU" ? "Critical Care" : "Inpatient Care",
    totalBeds: wardBeds.length,
    occupiedBeds: wardBeds.filter((bed) => bed.status === "OCCUPIED").length,
    availableBeds: wardBeds.filter((bed) => bed.status === "AVAILABLE").length,
    status: "Active",
  };
}

export async function getBackendWardsBedsState(): Promise<Partial<WardsBedsState>> {
  const workplaceId = await getHmsWorkplaceId();
  const query = `?workplaceId=${encodeURIComponent(workplaceId)}&take=200`;
  const [wardsPayload, bedsPayload, admissionsPayload] = await Promise.all([
    hmsRequest<HmsEnvelope<BackendWard[]>>(`/api/hms/wards${query}`),
    hmsRequest<HmsEnvelope<BackendBed[]>>(`/api/hms/beds${query}`),
    hmsRequest<HmsEnvelope<BackendAdmission[]>>(`/api/hms/admissions${query}`),
  ]);
  const beds = bedsPayload.data;
  return {
    wards: wardsPayload.data.map((ward) => toFrontendWard(ward, beds)),
    beds: beds.map((bed) => toFrontendBed(bed, admissionsPayload.data)),
    allocations: admissionsPayload.data.map((admission) => {
      const bed = beds.find((item) => item.id === admission.bedId);
      return {
        id: admission.id,
        bedId: admission.bedId,
        bedNumber: bed?.code ?? tailId(admission.bedId),
        wardName: bed?.ward?.name ?? "Hospital Ward",
        patientId: admission.patientId,
        patientName: `Patient ${tailId(admission.patientId)}`,
        doctorName: "Assigned Doctor",
        admissionType: "Elective IPD" as const,
        allocatedAt: iso(admission.admittedAt),
        releasedAt: admission.dischargedAt ? iso(admission.dischargedAt) : undefined,
        isolationPrecautions: "None" as const,
      };
    }),
    cleaningTasks: beds
      .filter((bed) => bed.status === "CLEANING")
      .map((bed) => ({
        id: `clean-${bed.id}`,
        bedId: bed.id,
        bedNumber: bed.code,
        wardName: bed.ward?.name ?? "Hospital Ward",
        triggeredAt: new Date().toISOString(),
        status: "Pending" as const,
        protocol: "Standard" as const,
        turnaroundMinutes: 25,
      })),
    history: [],
  };
}

type BackendEmergencyCase = {
  id: string;
  patientId: string;
  triageLevel: string;
  complaint: string;
  status: string;
  arrivedAt: string;
};

function toEmergencyPriority(level: string): EmergencyPriority {
  if (level === "RESUSCITATION" || level === "EMERGENT") return "Critical";
  if (level === "URGENT") return "High";
  return "Medium";
}

function toEmergencyStatus(status: string): EmergencyStatus {
  const map: Record<string, EmergencyStatus> = {
    WAITING: "Hospital Notified",
    IN_TREATMENT: "Acknowledged",
    ADMITTED: "Arrived",
    DISCHARGED: "Closed",
    TRANSFERRED: "Closed",
  };
  return map[status] ?? "Hospital Notified";
}

export async function getBackendEmergencyState(): Promise<Partial<EmergencyState>> {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendEmergencyCase[]>>(`/api/hms/emergency?workplaceId=${encodeURIComponent(workplaceId)}&take=100`);
  return {
    cases: payload.data.map((row): EmergencyCase => ({
      id: row.id,
      patientName: `Patient ${tailId(row.patientId)}`,
      location: "Emergency Department",
      destinationHospital: "Sunrise Hospital",
      priority: toEmergencyPriority(row.triageLevel),
      status: toEmergencyStatus(row.status),
      deliveryState: row.status === "WAITING" ? "Pending Ack" : "Delivered",
      flowType: "Flow A (Active Relationship)",
      createdAt: iso(row.arrivedAt),
      slaBreached: row.status === "WAITING" && Date.now() - new Date(row.arrivedAt).getTime() > 15 * 60 * 1000,
      chiefComplaint: row.complaint,
    })),
    auditLogs: [],
  };
}

type BackendSurgery = {
  id: string;
  patientId: string;
  surgeonId: string;
  roomId: string;
  procedure: string;
  startsAt: string;
  endsAt: string;
  status: string;
  consentRecorded: boolean;
  preOpCleared: boolean;
  operativeNote?: string | null;
};

function toSurgicalStatus(status: string): SurgicalCaseStatus {
  const map: Record<string, SurgicalCaseStatus> = {
    SCHEDULED: "Scheduled",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return map[status] ?? "Planning";
}

function readiness(row: BackendSurgery) {
  return Math.round(((row.consentRecorded ? 1 : 0) + (row.preOpCleared ? 1 : 0)) * 50);
}

function toFrontendSurgicalCase(row: BackendSurgery): SurgicalCase {
  const patientName = `Patient ${tailId(row.patientId)}`;
  return {
    id: row.id,
    patientId: row.patientId,
    patientName,
    procedureType: row.procedure,
    department: "Surgery",
    preferredDateTime: iso(row.startsAt),
    urgency: "Routine",
    status: toSurgicalStatus(row.status),
    readinessPercent: readiness(row),
    assignedSurgeonId: row.surgeonId,
    assignedSurgeonName: `Surgeon ${tailId(row.surgeonId)}`,
    allocatedOT: {
      roomId: row.roomId,
      startDateTime: iso(row.startsAt),
      endDateTime: iso(row.endsAt),
      team: [`Surgeon ${tailId(row.surgeonId)}`],
      resources: [],
    },
    checklist: [
      { id: `${row.id}-consent`, category: "consent", description: "Consent recorded", status: row.consentRecorded ? "Done" : "Pending", owner: "Surgery Desk", deadline: iso(row.startsAt) },
      { id: `${row.id}-preop`, category: "pre-op assessment", description: "Pre-op clearance", status: row.preOpCleared ? "Done" : "Pending", owner: "Clinical Team", deadline: iso(row.startsAt), isLifeCritical: true },
    ],
    linkedProcurementIds: [],
    postOpTasks: [],
  };
}

export async function getBackendSurgicalState(): Promise<Partial<SurgicalState>> {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendSurgery[]>>(`/api/hms/surgeries?workplaceId=${encodeURIComponent(workplaceId)}&take=100`);
  const cases = payload.data.map(toFrontendSurgicalCase);
  const history: SurgeryHistoryRecord[] = cases
    .filter((item) => item.status === "Completed" || item.status === "Cancelled")
    .map((item) => ({
      id: `hist-${item.id}`,
      caseId: item.id,
      patientId: item.patientId,
      patientName: item.patientName,
      procedureType: item.procedureType,
      department: item.department,
      surgeonName: item.assignedSurgeonName ?? "Assigned Surgeon",
      roomName: item.allocatedOT?.roomId ?? "OT Room",
      date: item.preferredDateTime.split("T")[0],
      durationMins: item.allocatedOT ? Math.max(0, Math.round((new Date(item.allocatedOT.endDateTime).getTime() - new Date(item.allocatedOT.startDateTime).getTime()) / 60000)) : 0,
      outcome: item.status === "Cancelled" ? "Cancelled" : "Successful",
      postOpSummary: item.status === "Cancelled" ? "Cancelled in backend HMS." : "Completed in backend HMS.",
      team: item.allocatedOT?.team ?? [],
    }));
  return { cases, history };
}

type BackendDocument = {
  id: string;
  title: string;
  category: string;
  storageKey: string;
  mimeType: string;
  expiresAt?: string | null;
  uploadedBy: string;
  createdAt: string;
};

function documentCategory(category: string): HospitalDocumentItem["category"] {
  const map: Record<string, HospitalDocumentItem["category"]> = {
    LICENSE: "Licenses",
    CERTIFICATE: "Certificates",
    CONTRACT: "Contracts",
    POLICY: "Policies",
    PATIENT: "Hospital Documents",
    STAFF: "Staff Documents",
  };
  return map[category] ?? "Hospital Documents";
}

function fileType(mimeType: string): HospitalDocumentItem["fileType"] {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOCX";
  return "IMAGE";
}

function isExpired(expiresAt?: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

function toFrontendDocument(row: BackendDocument): HospitalDocumentItem {
  const category = documentCategory(row.category);
  const createdAt = displayDateTime(row.createdAt);
  return {
    id: row.id,
    documentCode: `${row.category}-${tailId(row.id)}`,
    title: row.title,
    category,
    subCategory: category,
    version: "v1.0",
    versionHistory: [{
      version: "v1.0",
      modifiedAt: createdAt,
      modifiedBy: row.uploadedBy,
      changeSummary: "Imported from backend HMS document store.",
      fileUrl: `/${row.storageKey}`,
      fileSize: "Stored file",
    }],
    issuerAuthority: "Hospital Administration",
    issueDate: iso(row.createdAt).split("T")[0],
    expiryDate: row.expiresAt ? iso(row.expiresAt).split("T")[0] : null,
    expiryAlertDays: row.expiresAt ? 30 : null,
    isExpired: isExpired(row.expiresAt),
    securityClassification: category === "Certificates" ? "Public Redacted" : "Internal Staff Read-Only",
    isPublicCertificate: category === "Certificates",
    redactionStatus: category === "Certificates" ? "Pending Redaction" : "Not Required",
    fileUrl: `/${row.storageKey}`,
    fileSize: "Stored file",
    fileType: fileType(row.mimeType),
    uploadedBy: row.uploadedBy,
    uploadedAt: createdAt,
    tags: [category],
  };
}

function buildDocumentAnalytics(documents: HospitalDocumentItem[]): DocumentsState["analytics"] {
  const now = Date.now();
  const daysUntil = (date?: string | null) => date ? Math.ceil((new Date(date).getTime() - now) / 86_400_000) : Infinity;
  return {
    totalDocumentsCount: documents.length,
    activePoliciesCount: documents.filter((doc) => doc.category === "Policies" && !doc.isExpired).length,
    professionalLicensesCount: documents.filter((doc) => doc.category === "Licenses").length,
    regulatoryCertificatesCount: documents.filter((doc) => doc.category === "Certificates").length,
    activeContractsCount: documents.filter((doc) => doc.category === "Contracts" && !doc.isExpired).length,
    expiringIn30DaysCount: documents.filter((doc) => daysUntil(doc.expiryDate) <= 30).length,
    expiringIn60DaysCount: documents.filter((doc) => daysUntil(doc.expiryDate) <= 60).length,
    expiringIn90DaysCount: documents.filter((doc) => daysUntil(doc.expiryDate) <= 90).length,
    publicRedactedCertsCount: documents.filter((doc) => doc.isPublicCertificate).length,
  };
}

export async function getBackendDocumentsState(): Promise<Partial<DocumentsState>> {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendDocument[]>>(`/api/hms/documents?workplaceId=${encodeURIComponent(workplaceId)}&take=100`);
  const documents = payload.data.map(toFrontendDocument);
  return { documents, policyTemplates: [], contracts: [], analytics: buildDocumentAnalytics(documents) };
}

type BackendProfile = {
  description: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facilities?: string[];
  updatedAt?: string | null;
};

export async function getBackendHospitalProfileState(): Promise<Partial<HospitalProfileState>> {
  const workplaceId = await getHmsWorkplaceId();
  const [workplacesPayload, profilePayload] = await Promise.all([
    hmsRequest<HmsEnvelope<BackendWorkplace[]>>("/api/hms/workplaces"),
    hmsRequest<HmsEnvelope<BackendProfile | null>>(`/api/hms/profile?workplaceId=${encodeURIComponent(workplaceId)}`),
  ]);
  const workplace = workplacesPayload.data.find((item) => item.id === workplaceId) ?? workplacesPayload.data[0];
  const location = workplace?.workplace_locations?.find((item) => item.isPrimary) ?? workplace?.workplace_locations?.[0];
  const profile = profilePayload.data;
  return {
    basicInfo: {
      hospitalName: workplace?.name ?? "Hospital",
      legalEntityName: workplace?.legalName ?? workplace?.name ?? "Hospital",
      registrationNumber: "Backend HMS",
      tagline: "Connected to Qlyno HMS",
      establishedYear: 2018,
      hospitalType: "Multi-Specialty Tertiary Care",
      nabhAccreditationNumber: "Backend HMS",
      accreditationBadges: profile?.facilities ?? [],
      totalCampusAreaSqFt: 0,
      aboutOverview: profile?.description ?? "",
    },
    contactInfo: {
      generalPhone: profile?.phone ?? "",
      emergencyHelpline: profile?.phone ?? "",
      receptionPhone: profile?.phone ?? "",
      email: profile?.email ?? "",
      supportEmail: profile?.email ?? "",
      website: profile?.website ?? "",
      address: location?.addressLine1 ?? "",
      city: location?.city ?? "",
      state: location?.state ?? "",
      postalCode: location?.postalCode ?? "",
      country: "India",
      geoCoordinates: { latitude: 19.076, longitude: 72.8777, mapEmbedQuery: `${workplace?.name ?? "Hospital"} ${location?.city ?? ""}`.trim() },
      departmentExtensions: [],
    },
    facilityHighlights: (profile?.facilities ?? []).map((facility, index) => ({
      id: `facility-${index + 1}`,
      name: facility,
      category: "Specialized Units",
      description: facility,
      isLiveSynced: true,
      displayOrder: index + 1,
    })),
    lastUpdatedBy: "Backend HMS",
    lastUpdatedAt: profile?.updatedAt ? iso(profile.updatedAt) : new Date().toISOString(),
  };
}

type BackendContent = {
  id: string;
  title: string;
  kind: string;
  body: string;
  status: string;
  authorUserId: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "content";
}

function contentStatus(status: string): ContentStatus {
  const map: Record<string, ContentStatus> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    ARCHIVED: "Archived",
  };
  return map[status] ?? "Draft";
}

function toArticle(row: BackendContent): ArticleItem {
  return {
    id: row.id,
    title: row.title,
    slug: slugify(row.title),
    category: row.kind === "PROTOCOL" ? "Clinical Outcomes" : "Hospital News",
    summary: row.body.slice(0, 180),
    body: row.body,
    authorId: row.authorUserId,
    authorName: "Backend HMS",
    authorRole: "Hospital Administration",
    readTimeMinutes: Math.max(1, Math.ceil(row.body.split(/\s+/).length / 220)),
    tags: [row.kind],
    status: contentStatus(row.status),
    version: 1,
    publishedToPublic: row.status === "PUBLISHED",
    hospitalProfileSynced: row.status === "PUBLISHED",
    createdAt: displayDateTime(row.createdAt),
    updatedAt: displayDateTime(row.updatedAt),
  };
}

function toPatientEducation(row: BackendContent): PatientEducationItem {
  return {
    id: row.id,
    title: row.title,
    code: `EDU-${tailId(row.id)}`,
    type: "Leaflet",
    departmentId: "general",
    departmentName: "General Care",
    languages: ["English"],
    summary: row.body.slice(0, 180),
    contentSections: [{ heading: row.title, body: row.body }],
    destination: "Targeted Patient Dispatch",
    status: contentStatus(row.status),
    version: 1,
    dispatchCount: 0,
    createdAt: displayDateTime(row.createdAt),
    updatedAt: displayDateTime(row.updatedAt),
  };
}

export async function getBackendContentResourcesState(): Promise<Partial<ContentResourcesState>> {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendContent[]>>(`/api/hms/content?workplaceId=${encodeURIComponent(workplaceId)}&take=100`);
  return {
    articles: payload.data.filter((row) => row.kind === "ARTICLE" || row.kind === "PROTOCOL").map(toArticle),
    videos: payload.data
      .filter((row) => row.kind === "VIDEO_LINK")
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.body,
        category: "Patient Education" as const,
        videoUrl: row.body,
        thumbnailUrl: "",
        durationSeconds: 0,
        quality: "1080p" as const,
        hasCaptions: false,
        status: contentStatus(row.status),
        requiresClinicalReview: false,
        publishedToPublic: row.status === "PUBLISHED",
        createdAt: displayDateTime(row.createdAt),
      })),
    patientEducation: payload.data.filter((row) => row.kind === "PATIENT_EDUCATION").map(toPatientEducation),
    doctorContent: [],
    departmentContent: [],
  };
}

type BackendReview = {
  id: string;
  displayName: string;
  rating: number;
  comment: string;
  response?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  createdAt: string;
};

function sentimentForRating(rating: number): ReviewSentiment {
  if (rating >= 4) return "Positive";
  if (rating === 3) return "Neutral";
  return "Negative";
}

function toPatientReview(row: BackendReview): PatientReviewItem {
  return {
    id: row.id,
    source: "Portal App",
    patientName: row.displayName,
    rating: row.rating,
    reviewText: row.comment,
    submittedAt: displayDateTime(row.createdAt),
    responded: Boolean(row.response),
    responseText: row.response,
    respondedBy: row.respondedBy,
    respondedAt: row.respondedAt ? displayDateTime(row.respondedAt) : null,
    sentiment: sentimentForRating(row.rating),
    tags: ["Backend HMS"],
  };
}

function buildReviewAnalytics(reviews: PatientReviewItem[]): ReviewAnalyticsSummary {
  const total = reviews.length;
  const count = (sentiment: ReviewSentiment) => reviews.filter((review) => review.sentiment === sentiment).length;
  const percent = (value: number) => total ? Math.round((value / total) * 100) : 0;
  const positive = count("Positive");
  const neutral = count("Neutral");
  const negative = count("Negative");
  return {
    hospitalAverageRating: total ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / total).toFixed(1)) : 0,
    totalReviewsCount: total,
    npsScore: percent(positive) - percent(negative),
    npsPromotersPercent: percent(positive),
    npsPassivesPercent: percent(neutral),
    npsDetractorsPercent: percent(negative),
    averageResponseTimeHours: 0,
    responseRatePercent: percent(reviews.filter((review) => review.responded).length),
    unansweredCount: reviews.filter((review) => !review.responded).length,
    activeGrievancesCount: 0,
    monthlyRatingTrend: [],
    monthlyNpsTrend: [],
    sentimentBreakdown: [
      { sentiment: "Positive", count: positive, percentage: percent(positive) },
      { sentiment: "Neutral", count: neutral, percentage: percent(neutral) },
      { sentiment: "Negative", count: negative, percentage: percent(negative) },
    ],
    categorySentiment: [],
  };
}

export async function getBackendPatientReviewsState(): Promise<Partial<PatientReviewsState>> {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendReview[]>>(`/api/hms/reviews?workplaceId=${encodeURIComponent(workplaceId)}&take=100`);
  const reviews = payload.data.map(toPatientReview);
  return {
    reviews,
    npsResponses: [],
    grievances: [],
    doctorScorecards: [],
    departmentScorecards: [],
    analytics: buildReviewAnalytics(reviews),
    isSyncingGoogle: false,
    lastSyncedAt: displayDateTime(new Date().toISOString()),
  };
}

type BackendAmbulance = {
  id: string;
  registrationNumber: string;
  type: string;
  driverName: string;
  driverPhone: string;
  driverLicense?: string | null;
  driverShift?: string | null;
  equipment?: string[];
  baseLocation?: string | null;
  crew?: unknown;
  telemetry?: unknown;
  maintenanceNotes?: string | null;
  status: string;
};

type BackendAmbulanceTrip = {
  id: string;
  ambulanceId: string;
  emergencyCaseId?: string | null;
  patientName?: string | null;
  isPatientLinked: boolean;
  pickup: string;
  destination: string;
  priority: string;
  status: string;
  dispatchedAt: string;
  atSceneAt?: string | null;
  arrivedHospitalAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  rerouteHistory?: unknown;
  notes?: string | null;
  ambulance?: BackendAmbulance;
};

function toFrontendAmbulanceStatus(status: string): AmbulanceStatus {
  const map: Record<string, AmbulanceStatus> = {
    AVAILABLE: "Available",
    DISPATCHED: "Dispatched",
    EN_ROUTE: "En Route",
    AT_SCENE: "At Scene",
    TRANSPORTING: "Transporting",
    AT_HOSPITAL: "At Hospital",
    MAINTENANCE_OFFLINE: "Maintenance/Offline",
  };
  return map[status] ?? "Available";
}

function toBackendAmbulanceStatus(status: AmbulanceStatus) {
  const map: Record<AmbulanceStatus, string> = {
    Available: "AVAILABLE",
    Dispatched: "DISPATCHED",
    "En Route": "EN_ROUTE",
    "At Scene": "AT_SCENE",
    Transporting: "TRANSPORTING",
    "At Hospital": "AT_HOSPITAL",
    "Maintenance/Offline": "MAINTENANCE_OFFLINE",
  };
  return map[status];
}

function toFrontendAmbulanceType(type: string): AmbulanceType {
  const map: Record<string, AmbulanceType> = {
    ALS: "ALS",
    ADVANCED: "ALS",
    BLS: "BLS",
    BASIC: "BLS",
    NEONATAL_ICU: "Neonatal ICU",
    PATIENT_TRANSPORT: "Patient Transport",
  };
  return map[type] ?? "ALS";
}

function toBackendAmbulanceType(type: AmbulanceType) {
  const map: Record<AmbulanceType, string> = {
    ALS: "ALS",
    BLS: "BLS",
    "Neonatal ICU": "NEONATAL_ICU",
    "Patient Transport": "PATIENT_TRANSPORT",
  };
  return map[type];
}

function toFrontendTripStatus(status: string): DispatchStatus {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "RE_ROUTED") return "Re-routed";
  if (status === "DISPATCHED") return "Assigned";
  return "In Progress";
}

function toBackendTripStatus(status: AmbulanceStatus) {
  const map: Partial<Record<AmbulanceStatus, string>> = {
    "En Route": "EN_ROUTE",
    "At Scene": "AT_SCENE",
    Transporting: "TRANSPORTING",
    "At Hospital": "AT_HOSPITAL",
    Available: "COMPLETED",
  };
  return map[status];
}

function toFrontendPriority(priority: string): DispatchRecord["priority"] {
  if (priority === "CRITICAL") return "Critical - Code Red";
  if (priority === "STANDARD") return "Standard Transport";
  return "Urgent - Code Yellow";
}

function toBackendPriority(priority: DispatchRecord["priority"]) {
  if (priority === "Critical - Code Red") return "CRITICAL";
  if (priority === "Standard Transport") return "STANDARD";
  return "URGENT";
}

function toFrontendCrewRole(role: string): CrewMember["role"] {
  const map: Record<string, CrewMember["role"]> = {
    PARAMEDIC: "Paramedic",
    EMT: "EMT",
    EMERGENCY_NURSE: "Emergency Nurse",
    TRIAGE_SPECIALIST: "Triage Specialist",
  };
  return map[role] ?? "Paramedic";
}

function toBackendCrewRole(role: CrewMember["role"]) {
  const map: Record<CrewMember["role"], string> = {
    Paramedic: "PARAMEDIC",
    EMT: "EMT",
    "Emergency Nurse": "EMERGENCY_NURSE",
    "Triage Specialist": "TRIAGE_SPECIALIST",
  };
  return map[role];
}

function toBackendCrew(crew: CrewMember[] = []) {
  return crew.map((member) => ({
    name: member.name,
    role: toBackendCrewRole(member.role),
    phone: member.phone,
  }));
}

function crewFromBackend(value: unknown): CrewMember[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && "name" in item && "role" in item && "phone" in item))
        .map((item) => ({
          name: String(item.name),
          role: toFrontendCrewRole(String(item.role)),
          phone: String(item.phone),
        }))
    : [];
}

function telemetryFromBackend(value: unknown): TelemetryData {
  if (value && typeof value === "object") {
    const item = value as Partial<TelemetryData>;
    return {
      lat: typeof item.lat === "number" ? item.lat : 19.076,
      lng: typeof item.lng === "number" ? item.lng : 72.8777,
      speedKmH: typeof item.speedKmH === "number" ? item.speedKmH : 0,
      heading: item.heading ?? "Stationary",
      isGpsOnline: item.isGpsOnline ?? true,
      lastPing: item.lastPing ?? "Just now",
    };
  }
  return { lat: 19.076, lng: 72.8777, speedKmH: 0, heading: "Stationary", isGpsOnline: true, lastPing: "Just now" };
}

export function toFrontendAmbulance(row: BackendAmbulance): Ambulance {
  return {
    id: row.id,
    vehicleNo: row.registrationNumber,
    type: toFrontendAmbulanceType(row.type),
    equipment: row.equipment ?? [],
    baseLocation: row.baseLocation ?? "Main ambulance bay",
    status: toFrontendAmbulanceStatus(row.status),
    driver: {
      name: row.driverName,
      phone: row.driverPhone,
      licenseNo: row.driverLicense ?? "",
      shift: row.driverShift ?? "",
    },
    driverName: row.driverName,
    crew: crewFromBackend(row.crew),
    telemetry: telemetryFromBackend(row.telemetry),
    maintenanceNotes: row.maintenanceNotes ?? undefined,
  };
}

function rerouteHistory(value: unknown): DispatchRecord["reRouteHistory"] {
  return Array.isArray(value)
    ? value.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          fromHospital: String(row.fromHospital ?? row.fromAmbulanceId ?? "Previous destination"),
          toHospital: String(row.toHospital ?? row.toAmbulanceId ?? "Updated destination"),
          reason: String(row.reason ?? "Operational change"),
          timestamp: String(row.timestamp ?? new Date().toISOString()),
          triggeredBy: String(row.triggeredBy ?? "Backend"),
        };
      })
    : [];
}

export function toFrontendDispatchRecord(row: BackendAmbulanceTrip): DispatchRecord {
  return {
    id: row.id,
    ambulanceId: row.ambulanceId,
    vehicleNo: row.ambulance?.registrationNumber ?? row.ambulanceId,
    caseId: row.emergencyCaseId ?? undefined,
    patientName: row.patientName ?? undefined,
    isPatientLinked: row.isPatientLinked,
    originAddress: row.pickup,
    destinationHospital: row.destination,
    priority: toFrontendPriority(row.priority),
    status: toFrontendTripStatus(row.status),
    timestamp: row.dispatchedAt,
    timestamps: {
      created: row.dispatchedAt,
      dispatched: row.dispatchedAt,
      atScene: row.atSceneAt ?? undefined,
      arrivedHospital: row.arrivedHospitalAt ?? undefined,
      completed: row.completedAt ?? row.cancelledAt ?? undefined,
    },
    reRouteHistory: rerouteHistory(row.rerouteHistory),
    notes: row.notes ?? undefined,
  };
}

export async function getBackendAmbulanceState() {
  const workplaceId = await getHmsWorkplaceId();
  const query = `?workplaceId=${encodeURIComponent(workplaceId)}&take=100`;
  const [fleetPayload, tripsPayload] = await Promise.all([
    hmsRequest<HmsEnvelope<BackendAmbulance[]>>(`/api/hms/ambulances${query}`),
    hmsRequest<HmsEnvelope<BackendAmbulanceTrip[]>>(`/api/hms/ambulance-trips${query}`),
  ]);
  return {
    workplaceId,
    fleet: fleetPayload.data.map(toFrontendAmbulance),
    dispatchHistory: tripsPayload.data.map(toFrontendDispatchRecord),
  };
}

export async function createBackendAmbulance(input: {
  vehicleNo: string;
  type: AmbulanceType;
  equipment: string[];
  baseLocation: string;
  maintenanceNotes?: string;
}) {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendAmbulance>>("/api/hms/ambulances", {
    method: "POST",
    body: JSON.stringify({
      workplaceId,
      registrationNumber: input.vehicleNo,
      type: toBackendAmbulanceType(input.type),
      equipment: input.equipment,
      baseLocation: input.baseLocation,
      maintenanceNotes: input.maintenanceNotes,
    }),
  });
  return toFrontendAmbulance(payload.data);
}

export async function updateBackendAmbulance(input: Ambulance) {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendAmbulance>>(`/api/hms/ambulances/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      workplaceId,
      registrationNumber: input.vehicleNo,
      type: toBackendAmbulanceType(input.type),
      driverName: input.driver?.name,
      driverPhone: input.driver?.phone,
      driverLicense: input.driver?.licenseNo,
      driverShift: input.driver?.shift,
      equipment: input.equipment,
      baseLocation: input.baseLocation,
      crew: toBackendCrew(input.crew),
      telemetry: input.telemetry,
      maintenanceNotes: input.maintenanceNotes,
    }),
  });
  return toFrontendAmbulance(payload.data);
}

export async function updateBackendAmbulanceStatus(ambulanceId: string, status: AmbulanceStatus, maintenanceNotes?: string) {
  const workplaceId = await getHmsWorkplaceId();
  const backendTripStatus = toBackendTripStatus(status);
  const currentState = await getBackendAmbulanceState();
  const activeTrip = currentState.dispatchHistory.find((trip) => trip.ambulanceId === ambulanceId && ["Assigned", "In Progress", "Re-routed"].includes(trip.status));

  if (activeTrip && backendTripStatus) {
    const payload = await hmsRequest<HmsEnvelope<BackendAmbulanceTrip>>(`/api/hms/ambulance-trips/${activeTrip.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ workplaceId, status: backendTripStatus, reason: status === "Available" ? "Mission completed" : undefined }),
    });
    return toFrontendDispatchRecord(payload.data);
  }

  await hmsRequest<HmsEnvelope<BackendAmbulance>>(`/api/hms/ambulances/${ambulanceId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ workplaceId, status: toBackendAmbulanceStatus(status), maintenanceNotes }),
  });
  return null;
}

export async function createBackendDispatch(input: {
  ambulanceId: string;
  caseId?: string;
  patientName?: string;
  isPatientLinked: boolean;
  originAddress: string;
  destinationHospital: string;
  priority: DispatchRecord["priority"];
  notes?: string;
}) {
  const workplaceId = await getHmsWorkplaceId();
  const payload = await hmsRequest<HmsEnvelope<BackendAmbulanceTrip>>("/api/hms/ambulance-trips", {
    method: "POST",
    body: JSON.stringify({
      workplaceId,
      ambulanceId: input.ambulanceId,
      emergencyCaseId: input.caseId && UUID_RE.test(input.caseId) ? input.caseId : undefined,
      patientName: input.patientName,
      isPatientLinked: input.isPatientLinked,
      originAddress: input.originAddress,
      destinationHospital: input.destinationHospital,
      priority: toBackendPriority(input.priority),
      notes: input.notes,
    }),
  });
  return toFrontendDispatchRecord(payload.data);
}

export async function rerouteBackendDispatch(ambulanceId: string, destination: string, reason: string) {
  const workplaceId = await getHmsWorkplaceId();
  const state = await getBackendAmbulanceState();
  const activeTrip = state.dispatchHistory.find((trip) => trip.ambulanceId === ambulanceId && ["Assigned", "In Progress", "Re-routed"].includes(trip.status));
  if (!activeTrip) throw new Error("No active dispatch found for this ambulance.");
  const payload = await hmsRequest<HmsEnvelope<BackendAmbulanceTrip>>(`/api/hms/ambulance-trips/${activeTrip.id}/reroute`, {
    method: "POST",
    body: JSON.stringify({ workplaceId, destination, reason }),
  });
  return toFrontendDispatchRecord(payload.data);
}

export async function reassignBackendDispatch(failedAmbulanceId: string, newAmbulanceId: string, reason: string) {
  const workplaceId = await getHmsWorkplaceId();
  const state = await getBackendAmbulanceState();
  const activeTrip = state.dispatchHistory.find((trip) => trip.ambulanceId === failedAmbulanceId && ["Assigned", "In Progress", "Re-routed"].includes(trip.status));
  if (!activeTrip) throw new Error("No active dispatch found for this ambulance.");
  const payload = await hmsRequest<HmsEnvelope<BackendAmbulanceTrip>>(`/api/hms/ambulance-trips/${activeTrip.id}/reassign`, {
    method: "POST",
    body: JSON.stringify({ workplaceId, newAmbulanceId, reason }),
  });
  return toFrontendDispatchRecord(payload.data);
}
