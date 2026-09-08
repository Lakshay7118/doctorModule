import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  HospitalProfileState,
  BasicInformationData,
  ContactInformationData,
  DepartmentFeature,
  ServiceOffering,
  DoctorFeature,
  FacilityHighlight,
  MediaAsset,
  QlynoProfileSettings,
} from "@/hospital-admin/lib/types/hospital-profile";
import { detailedDepartments } from "@/hospital-admin/lib/mock-data/departments";
import { mockDoctorAffiliations } from "@/hospital-admin/lib/mock-data/verification-cases";

const initialDepartments: DepartmentFeature[] = detailedDepartments.slice(0, 10).map((dept, idx) => ({
  departmentId: dept.id,
  name: dept.name,
  categoryName: dept.categoryName || "Medical Specialties",
  featured: idx < 6,
  publicDescription: dept.description || "Comprehensive clinical excellence and patient-first care.",
  displayOrder: idx + 1,
  highlightTag: idx === 0 ? "24/7 Primary Care" : idx === 1 ? "Center of Excellence" : undefined,
  bedCount: dept.bedCapacity || 15,
  headName: dept.headName,
}));

const initialDoctors: DoctorFeature[] = mockDoctorAffiliations.map((doc, idx) => {
  const isDoctorVerified = doc.platformCredentialsVerified && doc.hospitalAffiliationConfirmed && doc.publicSearchStatus === "Live / Searchable";
  return {
    doctorId: doc.doctorId,
    doctorName: doc.doctorName,
    specialty: doc.specialty,
    qualification: doc.qualification,
    registrationNo: doc.registrationNo,
    avatarUrl: doc.avatarUrl || "https://i.pravatar.cc/150",
    affiliationType: doc.affiliationType,
    featured: isDoctorVerified && idx < 4,
    publicBio: `${doc.doctorName} is a distinguished specialist in ${doc.specialty} with advanced credentials (${doc.qualification}). Affiliated as a ${doc.affiliationType} dedicated to compassionate, evidence-based care.`,
    displayOrder: idx + 1,
    specialtyHighlight: doc.specialty,
    isVerified: isDoctorVerified,
    publicSearchStatus: doc.publicSearchStatus as DoctorFeature["publicSearchStatus"],
  };
});

const initialServices: ServiceOffering[] = [
  {
    id: "srv_01",
    name: "Comprehensive Interventional Cardiology & Cath Lab",
    category: "Centers of Excellence",
    description: "24/7 primary angioplasty, complex coronary stenting, electrophysiology studies, and advanced structural heart interventions.",
    linkedCapabilityRef: "OT_SURGERY",
    linkedCapabilityName: "Cardiac OT & Cath Lab Operations",
    isFeatured: true,
    displayOrder: 1,
  },
  {
    id: "srv_02",
    name: "24/7 Level-1 Emergency & Polytrauma Resuscitation",
    category: "Emergency & Critical Care",
    description: "Multi-disciplinary trauma response team with direct express elevator to emergency OT suites and critical resuscitation bays.",
    linkedCapabilityRef: "EMERGENCY_TRAUMA",
    linkedCapabilityName: "Level-1 Emergency Trauma Console",
    isFeatured: true,
    displayOrder: 2,
  },
  {
    id: "srv_03",
    name: "Advanced Robotic & Minimally Invasive Joint Replacement",
    category: "Surgical Specialties",
    description: "Sub-millimeter precision knee and hip arthroplasty with computer-assisted navigation and rapid recovery protocols.",
    linkedCapabilityRef: "OT_SURGERY",
    linkedCapabilityName: "Modular OT Suite 1 & 2",
    isFeatured: true,
    displayOrder: 3,
  },
  {
    id: "srv_04",
    name: "Neurocritical Care & Comprehensive Stroke Center",
    category: "Centers of Excellence",
    description: "Thrombolysis, mechanical thrombectomy, and dedicated neuro-ICU beds with continuous intracranial pressure telemetry.",
    linkedCapabilityRef: "ICU_CRITICAL_CARE",
    linkedCapabilityName: "Intensive Care Unit (ICU)",
    isFeatured: true,
    displayOrder: 4,
  },
  {
    id: "srv_05",
    name: "Rapid Response ALS Ambulance & Mobile Intensive Care",
    category: "Emergency Transport",
    description: "GPS-synchronized Advanced Life Support ambulance fleet equipped with transport ventilators, multipara monitors, and emergency telemetry.",
    linkedCapabilityRef: "AMBULANCE_DISPATCH",
    linkedCapabilityName: "ALS Ambulance Dispatch Command",
    isFeatured: true,
    displayOrder: 5,
  },
];

const initialFacilities: FacilityHighlight[] = [
  {
    id: "fac_01",
    name: "Multi-Disciplinary Critical Care Unit (MICU / SICU / CCU)",
    category: "Critical Care & ICU",
    description: "Level-3 tertiary ICU with 1:1 nurse-to-patient ratio for ventilated patients, isolation cubicles, and central hemodialysis access.",
    linkedMetricRef: "ICU_BED_COUNT",
    linkedMetricLabel: "Wards & Beds ICU Capacity",
    isLiveSynced: true,
    displayOrder: 1,
  },
  {
    id: "fac_02",
    name: "GPS-Tracked Advanced Life Support (ALS) Ambulance Fleet",
    category: "Emergency Transport",
    description: "Fully equipped mobile intensive care ambulances with transport ventilators and real-time ER telemetry sync.",
    linkedMetricRef: "AMBULANCE_FLEET_COUNT",
    linkedMetricLabel: "Ambulance Fleet Size",
    isLiveSynced: true,
    displayOrder: 2,
  },
  {
    id: "fac_03",
    name: "Class-100 Laminar Airflow Modular Operation Theatres",
    category: "Operation Theatres",
    description: "HEPA-filtered positive pressure surgical suites equipped with 4K Karl Storz laparoscopy towers, C-Arm fluoroscopy, and integrated anesthesia consoles.",
    linkedMetricRef: "OT_ROOM_COUNT",
    linkedMetricLabel: "Surgical OT Suites Count",
    isLiveSynced: true,
    displayOrder: 3,
  },
  {
    id: "fac_04",
    name: "24/7 Resuscitation Bay & Level-1 Trauma Emergency",
    category: "Emergency & Trauma",
    description: "Dedicated acute trauma bay with central oxygen manifolds, crash carts, and direct express elevator to emergency surgery suites.",
    linkedMetricRef: "TRAUMA_LEVEL_CERT",
    linkedMetricLabel: "Trauma Level Rating",
    isLiveSynced: true,
    displayOrder: 4,
  },
];

const initialMediaAssets: MediaAsset[] = [
  {
    id: "med_01",
    title: "Hospital Main Campus & Modern Exterior",
    category: "Facility Exterior",
    fileUrl: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=1200&q=80",
    caption: "State-of-the-art 120,000 sq.ft. multi-specialty tertiary care hospital campus in Mumbai.",
    isCover: true,
    displayOrder: 1,
    uploadedAt: "2026-08-01T10:00:00Z",
    uploadedBy: "Akash Sharma (Admin)",
    fileSize: "3.2 MB",
  },
  {
    id: "med_02",
    title: "Advanced Modular Operation Theatre Complex",
    category: "Operation Theatres",
    fileUrl: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=80",
    caption: "Class-100 HEPA filtered modular OT with Carl Zeiss microscope and 4K laparoscopic imaging.",
    isCover: false,
    displayOrder: 2,
    uploadedAt: "2026-08-05T14:30:00Z",
    uploadedBy: "Akash Sharma (Admin)",
    fileSize: "4.1 MB",
  },
  {
    id: "med_03",
    title: "Level-3 Multi-Disciplinary Intensive Care Unit",
    category: "Intensive Care Unit (ICU)",
    fileUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
    caption: "24-bed ICU critical care unit with Dräger ventilators and continuous central multipara telemetry.",
    isCover: false,
    displayOrder: 3,
    uploadedAt: "2026-08-08T11:15:00Z",
    uploadedBy: "Akash Sharma (Admin)",
    fileSize: "2.8 MB",
  },
  {
    id: "med_04",
    title: "Patient Welcoming Lobby & Reception Atrium",
    category: "Lobby & Reception",
    fileUrl: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=80",
    caption: "Spacious reception lounge with digital token kiosks, insurance helpdesk, and patient assistance.",
    isCover: false,
    displayOrder: 4,
    uploadedAt: "2026-08-10T09:20:00Z",
    uploadedBy: "Akash Sharma (Admin)",
    fileSize: "2.4 MB",
  },
];

const initialBasicInfo: BasicInformationData = {
  hospitalName: "Qlyno Multispecialty Hospital",
  legalEntityName: "Qlyno Healthcare Private Limited",
  registrationNumber: "U85110MH2018PTC309112",
  tagline: "NABH & AERB Accredited Tertiary Care Hospital",
  establishedYear: 2018,
  hospitalType: "Multi-Specialty Tertiary Care",
  nabhAccreditationNumber: "NABH-HOSP-2024-88912",
  accreditationBadges: [
    "NABH Accredited Tertiary Care Hospital",
    "AERB Certified Medical Radiation Safety",
    "ISO 9001:2015 Healthcare Quality Management",
    "State Pollution Control Board Green Hospital Certified",
  ],
  totalCampusAreaSqFt: 120000,
  aboutOverview:
    "Qlyno Multispecialty Hospital is a premier tertiary healthcare institution providing compassionate, world-class medical and surgical care. Equipped with cutting-edge medical technology and a distinguished faculty of clinicians, we deliver patient-centric excellence across more than 25 specialties.",
};

const initialContactInfo: ContactInformationData = {
  generalPhone: "+91 22 6100 8800",
  emergencyHelpline: "1066 / +91 22 6100 8911",
  receptionPhone: "+91 22 6100 8810",
  email: "care@qlyno.health",
  supportEmail: "support@qlyno.health",
  website: "https://www.qlyno.health",
  address: "Plot 42, Healthcare City, Andheri East",
  city: "Mumbai",
  state: "Maharashtra",
  postalCode: "400069",
  country: "India",
  geoCoordinates: {
    latitude: 19.1136,
    longitude: 72.8697,
    mapEmbedQuery: "Qlyno Multispecialty Hospital Andheri East Mumbai",
  },
  departmentExtensions: [
    { id: "ext_01", departmentName: "Emergency & Trauma Triage Desk", extensionNumber: "101", directPhone: "+91 22 6100 8911", operatingHours: "24 Hours / 7 Days", isEmergencyLine: true },
    { id: "ext_02", departmentName: "Ambulance Dispatch Command", extensionNumber: "102", directPhone: "+91 22 6100 8912", operatingHours: "24 Hours / 7 Days", isEmergencyLine: true },
    { id: "ext_03", departmentName: "Central Inpatient Reception & Admissions", extensionNumber: "201", directPhone: "+91 22 6100 8810", operatingHours: "24 Hours / 7 Days", isEmergencyLine: false },
    { id: "ext_04", departmentName: "Intensive Care Unit (ICU) Nursing Station", extensionNumber: "301", directPhone: "+91 22 6100 8830", operatingHours: "24 Hours / 7 Days", isEmergencyLine: false },
    { id: "ext_05", departmentName: "Insurance Desk & TPA Pre-Authorization", extensionNumber: "401", directPhone: "+91 22 6100 8840", operatingHours: "08:00 AM – 08:00 PM", isEmergencyLine: false },
    { id: "ext_06", departmentName: "Blood Bank & Component Laboratory", extensionNumber: "501", directPhone: "+91 22 6100 8850", operatingHours: "24 Hours / 7 Days", isEmergencyLine: true },
  ],
};

const initialQlynoSettings: QlynoProfileSettings = {
  networkParticipation: true,
  emergencyCapacitySignalEnabled: false,
  serviceAvailabilityPublished: true,
  publicSearchVisibility: "Visible / Indexed",
  verificationStatus: "Verified",
  lastVerifiedDate: "2026-08-05",
};

const initialState: HospitalProfileState = {
  basicInfo: initialBasicInfo,
  contactInfo: initialContactInfo,
  departmentFeatures: initialDepartments,
  serviceOfferings: initialServices,
  doctorFeatures: initialDoctors,
  facilityHighlights: initialFacilities,
  mediaAssets: initialMediaAssets,
  qlynoSettings: initialQlynoSettings,
  materialChangesPending: false,
  materialChangeLogs: [],
  lastUpdatedBy: "Akash Sharma (Hospital Administrator)",
  lastUpdatedAt: new Date().toISOString(),
};

// Material fields that trigger Module 13 re-verification review
const MATERIAL_FIELDS: (keyof BasicInformationData)[] = [
  "legalEntityName",
  "registrationNumber",
  "hospitalType",
  "nabhAccreditationNumber",
];

export const hospitalProfileSlice = createSlice({
  name: "hospitalProfile",
  initialState,
  reducers: {
    hydrateHospitalProfileState: (state, action: PayloadAction<Partial<HospitalProfileState>>) => {
      Object.assign(state, action.payload);
    },

    updateBasicInfo: (state, action: PayloadAction<Partial<BasicInformationData>>) => {
      const updates = action.payload;
      let hasMaterialChange = false;

      MATERIAL_FIELDS.forEach((field) => {
        if (updates[field] !== undefined && updates[field] !== state.basicInfo[field]) {
          hasMaterialChange = true;
          state.materialChangeLogs.unshift({
            id: `mat_${Date.now()}_${field}`,
            fieldChanged: String(field),
            previousValue: String(state.basicInfo[field]),
            newValue: String(updates[field]),
            changedAt: new Date().toISOString(),
            changedBy: "Akash Sharma (Hospital Administrator)",
            reviewStatus: "Pending Module 13 Review",
          });
        }
      });

      state.basicInfo = { ...state.basicInfo, ...updates };
      if (hasMaterialChange) {
        state.materialChangesPending = true;
      }
      state.lastUpdatedAt = new Date().toISOString();
    },

    acknowledgeMaterialChangeReview: (state) => {
      state.materialChangesPending = false;
      state.materialChangeLogs = state.materialChangeLogs.map((log) => ({
        ...log,
        reviewStatus: "Acknowledged",
      }));
      state.lastUpdatedAt = new Date().toISOString();
    },

    updateContactInfo: (state, action: PayloadAction<Partial<ContactInformationData>>) => {
      state.contactInfo = { ...state.contactInfo, ...action.payload };
      state.lastUpdatedAt = new Date().toISOString();
    },

    addDepartmentExtension: (state, action: PayloadAction<Omit<ContactInformationData["departmentExtensions"][0], "id">>) => {
      const newExt = {
        ...action.payload,
        id: `ext_${Date.now()}`,
      };
      state.contactInfo.departmentExtensions.push(newExt);
      state.lastUpdatedAt = new Date().toISOString();
    },

    deleteDepartmentExtension: (state, action: PayloadAction<string>) => {
      state.contactInfo.departmentExtensions = state.contactInfo.departmentExtensions.filter(
        (ext) => ext.id !== action.payload
      );
      state.lastUpdatedAt = new Date().toISOString();
    },

    toggleDepartmentFeatured: (state, action: PayloadAction<string>) => {
      const dept = state.departmentFeatures.find((d) => d.departmentId === action.payload);
      if (dept) {
        dept.featured = !dept.featured;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    updateDepartmentDescription: (
      state,
      action: PayloadAction<{ departmentId: string; publicDescription: string; highlightTag?: string }>
    ) => {
      const dept = state.departmentFeatures.find((d) => d.departmentId === action.payload.departmentId);
      if (dept) {
        dept.publicDescription = action.payload.publicDescription;
        dept.highlightTag = action.payload.highlightTag;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    reorderDepartments: (state, action: PayloadAction<{ departmentId: string; newOrder: number }>) => {
      const dept = state.departmentFeatures.find((d) => d.departmentId === action.payload.departmentId);
      if (dept) {
        dept.displayOrder = action.payload.newOrder;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    addServiceOffering: (state, action: PayloadAction<Omit<ServiceOffering, "id">>) => {
      const newService: ServiceOffering = {
        ...action.payload,
        id: `srv_${Date.now()}`,
      };
      state.serviceOfferings.push(newService);
      state.lastUpdatedAt = new Date().toISOString();
    },

    updateServiceOffering: (state, action: PayloadAction<ServiceOffering>) => {
      const idx = state.serviceOfferings.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) {
        state.serviceOfferings[idx] = action.payload;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    deleteServiceOffering: (state, action: PayloadAction<string>) => {
      state.serviceOfferings = state.serviceOfferings.filter((s) => s.id !== action.payload);
      state.lastUpdatedAt = new Date().toISOString();
    },

    toggleDoctorFeatured: (state, action: PayloadAction<string>) => {
      const doc = state.doctorFeatures.find((d) => d.doctorId === action.payload);
      // Rule CANNOT #2 & Dep Rule #3: Only verified doctors can be featured
      if (doc && doc.isVerified) {
        doc.featured = !doc.featured;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    updateDoctorBio: (
      state,
      action: PayloadAction<{ doctorId: string; publicBio: string; specialtyHighlight?: string }>
    ) => {
      const doc = state.doctorFeatures.find((d) => d.doctorId === action.payload.doctorId);
      if (doc) {
        doc.publicBio = action.payload.publicBio;
        doc.specialtyHighlight = action.payload.specialtyHighlight;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    reorderDoctors: (state, action: PayloadAction<{ doctorId: string; newOrder: number }>) => {
      const doc = state.doctorFeatures.find((d) => d.doctorId === action.payload.doctorId);
      if (doc) {
        doc.displayOrder = action.payload.newOrder;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    addFacilityHighlight: (state, action: PayloadAction<Omit<FacilityHighlight, "id">>) => {
      const newFac: FacilityHighlight = {
        ...action.payload,
        id: `fac_${Date.now()}`,
      };
      state.facilityHighlights.push(newFac);
      state.lastUpdatedAt = new Date().toISOString();
    },

    updateFacilityHighlight: (state, action: PayloadAction<FacilityHighlight>) => {
      const idx = state.facilityHighlights.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) {
        state.facilityHighlights[idx] = action.payload;
        state.lastUpdatedAt = new Date().toISOString();
      }
    },

    deleteFacilityHighlight: (state, action: PayloadAction<string>) => {
      state.facilityHighlights = state.facilityHighlights.filter((f) => f.id !== action.payload);
      state.lastUpdatedAt = new Date().toISOString();
    },

    addMediaAsset: (state, action: PayloadAction<Omit<MediaAsset, "id" | "uploadedAt" | "uploadedBy">>) => {
      const newAsset: MediaAsset = {
        ...action.payload,
        id: `med_${Date.now()}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "Akash Sharma (Hospital Administrator)",
      };
      if (newAsset.isCover) {
        state.mediaAssets.forEach((m) => (m.isCover = false));
      }
      state.mediaAssets.push(newAsset);
      state.lastUpdatedAt = new Date().toISOString();
    },

    deleteMediaAsset: (state, action: PayloadAction<string>) => {
      state.mediaAssets = state.mediaAssets.filter((m) => m.id !== action.payload);
      state.lastUpdatedAt = new Date().toISOString();
    },

    setCoverPhoto: (state, action: PayloadAction<string>) => {
      state.mediaAssets.forEach((m) => {
        m.isCover = m.id === action.payload;
      });
      state.lastUpdatedAt = new Date().toISOString();
    },

    updateQlynoSettings: (state, action: PayloadAction<Partial<QlynoProfileSettings>>) => {
      state.qlynoSettings = { ...state.qlynoSettings, ...action.payload };
      state.lastUpdatedAt = new Date().toISOString();
    },
  },
});

export const {
  hydrateHospitalProfileState,
  updateBasicInfo,
  acknowledgeMaterialChangeReview,
  updateContactInfo,
  addDepartmentExtension,
  deleteDepartmentExtension,
  toggleDepartmentFeatured,
  updateDepartmentDescription,
  reorderDepartments,
  addServiceOffering,
  updateServiceOffering,
  deleteServiceOffering,
  toggleDoctorFeatured,
  updateDoctorBio,
  reorderDoctors,
  addFacilityHighlight,
  updateFacilityHighlight,
  deleteFacilityHighlight,
  addMediaAsset,
  deleteMediaAsset,
  setCoverPhoto,
  updateQlynoSettings,
} = hospitalProfileSlice.actions;

export default hospitalProfileSlice.reducer;
