import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  Ward,
  Bed,
  BedAllocation,
  BedTransferRequest,
  BedCleaningTask,
  BedHistoryEntry,
  BedStatus,
} from "@/hospital-admin/lib/types";

export interface WardsBedsState {
  wards: Ward[];
  beds: Bed[];
  allocations: BedAllocation[];
  transferRequests: BedTransferRequest[];
  cleaningTasks: BedCleaningTask[];
  history: BedHistoryEntry[];
}

const initialWards: Ward[] = [
  {
    id: "ward_gen_01",
    name: "General Medical Ward (Ward A)",
    type: "General",
    floor: "2nd Floor - East Wing",
    department: "General Medicine",
    totalBeds: 6,
    occupiedBeds: 4,
    availableBeds: 2,
    status: "Active",
  },
  {
    id: "ward_surg_01",
    name: "Surgical Inpatient Ward (Ward B)",
    type: "General",
    floor: "2nd Floor - West Wing",
    department: "General Surgery",
    totalBeds: 6,
    occupiedBeds: 4,
    availableBeds: 1,
    status: "Active",
  },
  {
    id: "ward_icu_01",
    name: "Intensive Care Unit (ICU)",
    type: "ICU",
    floor: "3rd Floor - Critical Care Block",
    department: "Critical Care",
    totalBeds: 6,
    occupiedBeds: 4,
    availableBeds: 1,
    status: "Active",
  },
  {
    id: "ward_ccu_01",
    name: "Coronary Care & HDU (CCU)",
    type: "CCU",
    floor: "3rd Floor - East Wing",
    department: "Cardiology",
    totalBeds: 4,
    occupiedBeds: 3,
    availableBeds: 1,
    status: "Active",
  },
  {
    id: "ward_iso_01",
    name: "Airborne & Droplet Isolation Unit",
    type: "Isolation",
    floor: "4th Floor - South Wing",
    department: "Pulmonology & Infectious Diseases",
    totalBeds: 4,
    occupiedBeds: 2,
    availableBeds: 1,
    status: "Active",
  },
  {
    id: "ward_deluxe_01",
    name: "Executive Deluxe & Private Suites",
    type: "Deluxe",
    floor: "5th Floor - Tower Wing",
    department: "Executive Inpatient Care",
    totalBeds: 4,
    occupiedBeds: 2,
    availableBeds: 2,
    status: "Active",
  },
];

const initialBeds: Bed[] = [
  // 1. GENERAL MEDICAL WARD (WARD A)
  {
    id: "bed_gw_101",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-101",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-1001",
    currentPatientName: "Ramesh Sharma",
    admittingDoctor: "Dr. Ananya Patel",
    admissionDate: "2026-08-19",
    lengthOfStayDays: 3,
    attachedEquipment: ["Oxygen Flowmeter", "IV Pole"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_gw_102",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-102",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-1002",
    currentPatientName: "Sita Devi",
    admittingDoctor: "Dr. Arvind Swaminathan",
    admissionDate: "2026-08-20",
    lengthOfStayDays: 2,
    attachedEquipment: ["Oxygen Flowmeter", "Multipara Monitor"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_gw_103",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-103",
    tier: "General",
    status: "Available",
    floor: "2nd Floor",
    attachedEquipment: ["Oxygen Flowmeter", "Standard Consoles"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_gw_104",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-104",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-1004",
    currentPatientName: "Vijay Varma",
    admittingDoctor: "Dr. Ananya Patel",
    admissionDate: "2026-08-18",
    lengthOfStayDays: 4,
    attachedEquipment: ["Oxygen Flowmeter"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_gw_105",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-105",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-1005",
    currentPatientName: "Amitabh Sen",
    admittingDoctor: "Dr. Rohan Mehta",
    admissionDate: "2026-08-21",
    lengthOfStayDays: 1,
    attachedEquipment: ["Multipara Monitor", "IV Infusion Pump"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_gw_106",
    wardId: "ward_gen_01",
    wardName: "General Medical Ward (Ward A)",
    bedNumber: "GW-106",
    tier: "General",
    status: "Available",
    floor: "2nd Floor",
    attachedEquipment: ["Standard Consoles"],
    nurseToPatientRatio: "1:4",
  },

  // 2. SURGICAL INPATIENT WARD (WARD B)
  {
    id: "bed_sw_201",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-201",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-8821",
    currentPatientName: "Arjun Gupta",
    admittingDoctor: "Dr. Ramesh Sharma",
    admissionDate: "2026-08-18",
    lengthOfStayDays: 4,
    attachedEquipment: ["Multipara Monitor", "Surgical Drain Suction", "IV Infusion Pump"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_sw_202",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-202",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-2002",
    currentPatientName: "Meenakshi Iyer",
    admittingDoctor: "Dr. Ramesh Sharma",
    admissionDate: "2026-08-20",
    lengthOfStayDays: 2,
    attachedEquipment: ["Multipara Monitor", "Oxygen Flowmeter"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_sw_203",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-203",
    tier: "General",
    status: "Reserved",
    floor: "2nd Floor",
    reservedForPatientName: "Pooja Hegde (Pre-Op Ortho CASE-411)",
    reservedExpiry: "2026-08-22T18:00:00Z",
    attachedEquipment: ["Standard Consoles"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_sw_204",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-204",
    tier: "General",
    status: "Cleaning",
    floor: "2nd Floor",
    turnoverETA: "20 mins",
    attachedEquipment: ["Standard Consoles"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_sw_205",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-205",
    tier: "General",
    status: "Occupied",
    floor: "2nd Floor",
    currentPatientId: "P-2005",
    currentPatientName: "Deepak Chaurasia",
    admittingDoctor: "Dr. Ramesh Sharma",
    admissionDate: "2026-08-19",
    lengthOfStayDays: 3,
    attachedEquipment: ["Multipara Monitor"],
    nurseToPatientRatio: "1:4",
  },
  {
    id: "bed_sw_206",
    wardId: "ward_surg_01",
    wardName: "Surgical Inpatient Ward (Ward B)",
    bedNumber: "SW-206",
    tier: "General",
    status: "Available",
    floor: "2nd Floor",
    attachedEquipment: ["Standard Consoles"],
    nurseToPatientRatio: "1:4",
  },

  // 3. INTENSIVE CARE UNIT (ICU)
  {
    id: "bed_icu_301",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-301",
    tier: "ICU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-9102",
    currentPatientName: "Kavita Patil",
    admittingDoctor: "Dr. Kavita Verma",
    admissionDate: "2026-08-19",
    lengthOfStayDays: 3,
    attachedEquipment: ["Hamilton C6 Mechanical Ventilator", "Mindray BeneVision N17 Monitor", "Arterial Line Monitor", "Syringe Pumps (4x)"],
    nurseToPatientRatio: "1:1",
  },
  {
    id: "bed_icu_302",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-302",
    tier: "ICU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-3002",
    currentPatientName: "Rajeshwar Rao",
    admittingDoctor: "Dr. Kavita Verma",
    admissionDate: "2026-08-18",
    lengthOfStayDays: 4,
    attachedEquipment: ["Dräger Savina 300 Ventilator", "Multipara Critical Monitor", "Syringe Pumps (2x)"],
    nurseToPatientRatio: "1:1",
  },
  {
    id: "bed_icu_303",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-303",
    tier: "ICU",
    status: "Cleaning",
    floor: "3rd Floor",
    turnoverETA: "35 mins (ICU Deep Disinfection)",
    attachedEquipment: ["Ventilator Ready Console", "Critical Monitor"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_icu_304",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-304",
    tier: "ICU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-3004",
    currentPatientName: "Farhan Qureshi",
    admittingDoctor: "Dr. Rohan Mehta",
    admissionDate: "2026-08-21",
    lengthOfStayDays: 1,
    attachedEquipment: ["High-Flow Nasal Cannula (HFNC)", "Mindray Monitor", "Infusion Pumps (2x)"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_icu_305",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-305",
    tier: "ICU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-3005",
    currentPatientName: "Jaspreet Kaur",
    admittingDoctor: "Dr. Kavita Verma",
    admissionDate: "2026-08-20",
    lengthOfStayDays: 2,
    attachedEquipment: ["Hamilton C6 Mechanical Ventilator", "Continuous Cardiac Monitor"],
    nurseToPatientRatio: "1:1",
  },
  {
    id: "bed_icu_306",
    wardId: "ward_icu_01",
    wardName: "Intensive Care Unit (ICU)",
    bedNumber: "ICU-306",
    tier: "ICU",
    status: "Available",
    floor: "3rd Floor",
    attachedEquipment: ["Ventilator Port", "Multipara Station", "Defibrillator Standby"],
    nurseToPatientRatio: "1:2",
  },

  // 4. CORONARY CARE & HDU (CCU)
  {
    id: "bed_ccu_401",
    wardId: "ward_ccu_01",
    wardName: "Coronary Care & HDU (CCU)",
    bedNumber: "CCU-401",
    tier: "CCU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-4001",
    currentPatientName: "Anil Kapoor",
    admittingDoctor: "Dr. Ananya Patel",
    admissionDate: "2026-08-19",
    lengthOfStayDays: 3,
    attachedEquipment: ["Continuous 12-Lead ECG Telemetry", "Non-Invasive Pacer Console", "IV Infusion Pump"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_ccu_402",
    wardId: "ward_ccu_01",
    wardName: "Coronary Care & HDU (CCU)",
    bedNumber: "CCU-402",
    tier: "CCU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-4002",
    currentPatientName: "Sunil Gavaskar",
    admittingDoctor: "Dr. Ananya Patel",
    admissionDate: "2026-08-21",
    lengthOfStayDays: 1,
    attachedEquipment: ["Continuous Cardiac Monitor", "IV Infusion Pump"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_ccu_403",
    wardId: "ward_ccu_01",
    wardName: "Coronary Care & HDU (CCU)",
    bedNumber: "CCU-403",
    tier: "CCU",
    status: "Occupied",
    floor: "3rd Floor",
    currentPatientId: "P-4003",
    currentPatientName: "Bhavna Parekh",
    admittingDoctor: "Dr. Ananya Patel",
    admissionDate: "2026-08-20",
    lengthOfStayDays: 2,
    attachedEquipment: ["Continuous Cardiac Monitor"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_ccu_404",
    wardId: "ward_ccu_01",
    wardName: "Coronary Care & HDU (CCU)",
    bedNumber: "CCU-404",
    tier: "CCU",
    status: "Available",
    floor: "3rd Floor",
    attachedEquipment: ["Cardiac Telemetry Transmitter", "Multipara Console"],
    nurseToPatientRatio: "1:2",
  },

  // 5. AIRBORNE & DROPLET ISOLATION UNIT
  {
    id: "bed_iso_501",
    wardId: "ward_iso_01",
    wardName: "Airborne & Droplet Isolation Unit",
    bedNumber: "ISO-501",
    tier: "Isolation",
    status: "Occupied",
    floor: "4th Floor",
    currentPatientId: "P-5001",
    currentPatientName: "Tariq Mansoor",
    admittingDoctor: "Dr. Arvind Swaminathan",
    admissionDate: "2026-08-19",
    lengthOfStayDays: 3,
    isolationFlags: "Airborne",
    negativePressure: true,
    attachedEquipment: ["HEPA Filtration Unit", "Negative Pressure Gauge (-2.5 Pa)", "Multipara Monitor"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_iso_502",
    wardId: "ward_iso_01",
    wardName: "Airborne & Droplet Isolation Unit",
    bedNumber: "ISO-502",
    tier: "Isolation",
    status: "Occupied",
    floor: "4th Floor",
    currentPatientId: "P-5002",
    currentPatientName: "Geeta Phogat",
    admittingDoctor: "Dr. Arvind Swaminathan",
    admissionDate: "2026-08-21",
    lengthOfStayDays: 1,
    isolationFlags: "Droplet",
    negativePressure: true,
    attachedEquipment: ["Negative Pressure Gauge (-2.5 Pa)", "Oxygen Flowmeter"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_iso_503",
    wardId: "ward_iso_01",
    wardName: "Airborne & Droplet Isolation Unit",
    bedNumber: "ISO-503",
    tier: "Isolation",
    status: "Cleaning",
    floor: "4th Floor",
    turnoverETA: "45 mins (Terminal-Isolation Protocol Required)",
    isolationFlags: "Airborne",
    negativePressure: true,
    attachedEquipment: ["HEPA Exhaust Port"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_iso_504",
    wardId: "ward_iso_01",
    wardName: "Airborne & Droplet Isolation Unit",
    bedNumber: "ISO-504",
    tier: "Isolation",
    status: "Available",
    floor: "4th Floor",
    isolationFlags: "None",
    negativePressure: true,
    attachedEquipment: ["Negative Pressure Clean Console"],
    nurseToPatientRatio: "1:2",
  },

  // 6. EXECUTIVE DELUXE & PRIVATE SUITES
  {
    id: "bed_dlx_601",
    wardId: "ward_deluxe_01",
    wardName: "Executive Deluxe & Private Suites",
    bedNumber: "DLX-601",
    tier: "Private Suite",
    status: "Occupied",
    floor: "5th Floor",
    currentPatientId: "P-6001",
    currentPatientName: "Harsh Vardhan",
    admittingDoctor: "Dr. Rohan Mehta",
    admissionDate: "2026-08-20",
    lengthOfStayDays: 2,
    attachedEquipment: ["Smart Vitals Station", "Attendant Suite Bed"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_dlx_602",
    wardId: "ward_deluxe_01",
    wardName: "Executive Deluxe & Private Suites",
    bedNumber: "DLX-602",
    tier: "Private Suite",
    status: "Occupied",
    floor: "5th Floor",
    currentPatientId: "P-6002",
    currentPatientName: "Shobha De",
    admittingDoctor: "Dr. Sunita Patel",
    admissionDate: "2026-08-21",
    lengthOfStayDays: 1,
    attachedEquipment: ["Smart Vitals Station"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_dlx_603",
    wardId: "ward_deluxe_01",
    wardName: "Executive Deluxe & Private Suites",
    bedNumber: "DLX-603",
    tier: "Private Suite",
    status: "Available",
    floor: "5th Floor",
    attachedEquipment: ["Deluxe Suite Amenities"],
    nurseToPatientRatio: "1:2",
  },
  {
    id: "bed_dlx_604",
    wardId: "ward_deluxe_01",
    wardName: "Executive Deluxe & Private Suites",
    bedNumber: "DLX-604",
    tier: "Private Suite",
    status: "Available",
    floor: "5th Floor",
    attachedEquipment: ["Deluxe Suite Amenities"],
    nurseToPatientRatio: "1:2",
  },
];

const initialCleaningTasks: BedCleaningTask[] = [
  {
    id: "clean_01",
    bedId: "bed_sw_204",
    bedNumber: "SW-204",
    wardName: "Surgical Inpatient Ward (Ward B)",
    triggeredAt: "2026-08-22T10:15:00Z",
    assignedStaffId: "sup_hk_01",
    assignedStaffName: "Sunita Reddy (Housekeeping Lead)",
    status: "In Progress",
    protocol: "Standard",
    turnaroundMinutes: 20,
    notes: "Post-discharge standard sanitization and linen replacement",
  },
  {
    id: "clean_02",
    bedId: "bed_icu_303",
    bedNumber: "ICU-303",
    wardName: "Intensive Care Unit (ICU)",
    triggeredAt: "2026-08-22T09:30:00Z",
    assignedStaffId: "sup_hk_02",
    assignedStaffName: "Ramesh Pawar (Housekeeping)",
    status: "In Progress",
    protocol: "Standard",
    turnaroundMinutes: 35,
    notes: "Ventilator circuit autoclaving and high-touch surface fogging",
  },
  {
    id: "clean_03",
    bedId: "bed_iso_503",
    bedNumber: "ISO-503",
    wardName: "Airborne & Droplet Isolation Unit",
    triggeredAt: "2026-08-22T08:45:00Z",
    assignedStaffId: "sup_hk_01",
    assignedStaffName: "Sunita Reddy (Housekeeping Lead)",
    status: "Pending",
    protocol: "Terminal-Isolation",
    turnaroundMinutes: 45,
    notes: "Mandatory UV-C deep sterilization & HEPA filter decontamination following airborne discharge",
  },
];

const initialHistory: BedHistoryEntry[] = [
  {
    id: "hist_01",
    bedId: "bed_gw_101",
    bedNumber: "GW-101",
    wardName: "General Medical Ward (Ward A)",
    eventType: "Allocation",
    patientName: "Ramesh Sharma",
    staffName: "Meenakshi Sundaram (IPD Admission)",
    timestamp: "2026-08-19T11:00:00Z",
    details: "Allocated for acute pneumonia inpatient treatment under Dr. Ananya Patel",
  },
  {
    id: "hist_02",
    bedId: "bed_sw_204",
    bedNumber: "SW-204",
    wardName: "Surgical Inpatient Ward (Ward B)",
    eventType: "Discharge",
    patientName: "Kishore Kumar",
    staffName: "Sister Mary Joseph (Ward Incharge)",
    timestamp: "2026-08-22T10:15:00Z",
    details: "Patient discharged following billing clearance. Bed auto-transitioned to Cleaning status.",
  },
  {
    id: "hist_03",
    bedId: "bed_icu_301",
    bedNumber: "ICU-301",
    wardName: "Intensive Care Unit (ICU)",
    eventType: "Allocation",
    patientName: "Kavita Patil",
    staffName: "Dr. Kavita Verma (Neuro Lead)",
    timestamp: "2026-08-19T14:30:00Z",
    details: "Emergency post-craniotomy ICU mechanical ventilation admission",
  },
];

const initialState: WardsBedsState = {
  wards: initialWards,
  beds: initialBeds,
  allocations: [],
  transferRequests: [
    {
      id: "trf_01",
      patientId: "P-1004",
      patientName: "Vijay Varma",
      fromBedId: "bed_gw_104",
      fromBedNumber: "GW-104",
      fromWard: "General Medical Ward (Ward A)",
      toBedId: "bed_dlx_603",
      toBedNumber: "DLX-603",
      toWard: "Executive Deluxe & Private Suites",
      reason: "Patient family requested upgrade to private deluxe suite",
      requestedBy: "Dr. Ananya Patel",
      approvedBy: "Hospital Admin",
      status: "Approved",
      requestedAt: "2026-08-22T11:30:00Z",
    },
  ],
  cleaningTasks: initialCleaningTasks,
  history: initialHistory,
};

const wardsBedsSlice = createSlice({
  name: "wardsBeds",
  initialState,
  reducers: {
    hydrateWardsBedsState: (state, action: PayloadAction<Partial<WardsBedsState>>) => {
      if (action.payload.wards) state.wards = action.payload.wards;
      if (action.payload.beds) state.beds = action.payload.beds;
      if (action.payload.allocations) state.allocations = action.payload.allocations;
      if (action.payload.transferRequests) state.transferRequests = action.payload.transferRequests;
      if (action.payload.cleaningTasks) state.cleaningTasks = action.payload.cleaningTasks;
      if (action.payload.history) state.history = action.payload.history;
    },

    // 1. WARD MANAGEMENT
    addWard: (state, action: PayloadAction<Omit<Ward, "id" | "occupiedBeds" | "availableBeds">>) => {
      const newWard: Ward = {
        ...action.payload,
        id: `ward_${Date.now()}`,
        occupiedBeds: 0,
        availableBeds: action.payload.totalBeds,
      };
      state.wards.push(newWard);
    },
    updateWard: (state, action: PayloadAction<Ward>) => {
      const idx = state.wards.findIndex((w) => w.id === action.payload.id);
      if (idx !== -1) {
        state.wards[idx] = action.payload;
      }
    },
    deactivateWard: (state, action: PayloadAction<string>) => {
      const ward = state.wards.find((w) => w.id === action.payload);
      if (ward) {
        // Enforce Guard: Zero occupied/reserved beds
        const occupiedCount = state.beds.filter(
          (b) => b.wardId === ward.id && (b.status === "Occupied" || b.status === "Reserved")
        ).length;
        if (occupiedCount === 0) {
          ward.status = "Inactive";
        }
      }
    },

    // 2. BED ALLOCATION (Available -> Occupied)
    allocateBed: (
      state,
      action: PayloadAction<{
        bedId: string;
        patientId: string;
        patientName: string;
        doctorName: string;
        admissionType: "Emergency" | "Elective IPD" | "OT Post-Op" | "Direct Transfer";
        isolationPrecautions?: "Droplet" | "Airborne" | "Contact" | "None";
        notes?: string;
      }>
    ) => {
      const bed = state.beds.find((b) => b.id === action.payload.bedId);
      if (bed && (bed.status === "Available" || bed.status === "Reserved")) {
        bed.status = "Occupied";
        bed.currentPatientId = action.payload.patientId;
        bed.currentPatientName = action.payload.patientName;
        bed.admittingDoctor = action.payload.doctorName;
        bed.admissionDate = new Date().toISOString().split("T")[0];
        bed.lengthOfStayDays = 1;
        bed.isolationFlags = action.payload.isolationPrecautions || "None";
        bed.reservedForPatientName = undefined;
        bed.reservedExpiry = undefined;

        // Recalculate ward counts
        const ward = state.wards.find((w) => w.id === bed.wardId);
        if (ward) {
          ward.occupiedBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Occupied").length;
          ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
        }

        // Record history
        state.history.unshift({
          id: `hist_${Date.now()}`,
          bedId: bed.id,
          bedNumber: bed.bedNumber,
          wardName: bed.wardName,
          eventType: "Allocation",
          patientName: action.payload.patientName,
          staffName: action.payload.doctorName,
          timestamp: new Date().toISOString(),
          details: `Bed allocated via ${action.payload.admissionType}. ${action.payload.notes || ""}`,
        });
      }
    },

    // 3. BED RELEASE (Occupied -> Cleaning, Auto-Creates Cleaning Task)
    releaseBed: (
      state,
      action: PayloadAction<{
        bedId: string;
        releasedBy: string;
        reason?: string;
      }>
    ) => {
      const bed = state.beds.find((b) => b.id === action.payload.bedId);
      if (bed && bed.status === "Occupied") {
        const formerPatient = bed.currentPatientName;
        const isIsolation = bed.tier === "Isolation" || (bed.isolationFlags && bed.isolationFlags !== "None");

        bed.status = "Cleaning";
        bed.currentPatientId = undefined;
        bed.currentPatientName = undefined;
        bed.admittingDoctor = undefined;
        bed.turnoverETA = isIsolation ? "45 mins" : "25 mins";

        // Recalculate ward counts
        const ward = state.wards.find((w) => w.id === bed.wardId);
        if (ward) {
          ward.occupiedBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Occupied").length;
          ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
        }

        // Auto-create Cleaning Task (Rule F12-CANNOT-5 & CANNOT-6)
        state.cleaningTasks.unshift({
          id: `clean_${Date.now()}`,
          bedId: bed.id,
          bedNumber: bed.bedNumber,
          wardName: bed.wardName,
          triggeredAt: new Date().toISOString(),
          status: "Pending",
          protocol: isIsolation ? "Terminal-Isolation" : "Standard",
          turnaroundMinutes: isIsolation ? 45 : 25,
          notes: `Auto-created on discharge/release of ${formerPatient || "patient"}. ${action.payload.reason || ""}`,
        });

        // Record history
        state.history.unshift({
          id: `hist_${Date.now()}`,
          bedId: bed.id,
          bedNumber: bed.bedNumber,
          wardName: bed.wardName,
          eventType: "Discharge",
          patientName: formerPatient,
          staffName: action.payload.releasedBy,
          timestamp: new Date().toISOString(),
          details: `Bed vacated & released. Auto-triggered ${isIsolation ? "Terminal-Isolation" : "Standard"} cleaning protocol.`,
        });
      }
    },

    // 4. ATOMIC BED TRANSFER
    executeBedTransfer: (
      state,
      action: PayloadAction<{
        requestId: string;
        fromBedId: string;
        toBedId: string;
        patientId: string;
        patientName: string;
        transferredBy: string;
      }>
    ) => {
      const fromBed = state.beds.find((b) => b.id === action.payload.fromBedId);
      const toBed = state.beds.find((b) => b.id === action.payload.toBedId);

      if (fromBed && toBed && toBed.status === "Available") {
        const isIsolationFrom = fromBed.tier === "Isolation" || (fromBed.isolationFlags && fromBed.isolationFlags !== "None");

        // Occupy destination
        toBed.status = "Occupied";
        toBed.currentPatientId = action.payload.patientId;
        toBed.currentPatientName = action.payload.patientName;
        toBed.admissionDate = fromBed.admissionDate || new Date().toISOString().split("T")[0];
        toBed.admittingDoctor = fromBed.admittingDoctor;
        toBed.lengthOfStayDays = fromBed.lengthOfStayDays;

        // Release origin to Cleaning
        fromBed.status = "Cleaning";
        fromBed.currentPatientId = undefined;
        fromBed.currentPatientName = undefined;
        fromBed.admittingDoctor = undefined;
        fromBed.turnoverETA = isIsolationFrom ? "45 mins" : "25 mins";

        // Mark transfer request completed
        const req = state.transferRequests.find((r) => r.id === action.payload.requestId);
        if (req) {
          req.status = "Completed";
        }

        // Auto-create Cleaning Task for origin
        state.cleaningTasks.unshift({
          id: `clean_${Date.now()}`,
          bedId: fromBed.id,
          bedNumber: fromBed.bedNumber,
          wardName: fromBed.wardName,
          triggeredAt: new Date().toISOString(),
          status: "Pending",
          protocol: isIsolationFrom ? "Terminal-Isolation" : "Standard",
          turnaroundMinutes: isIsolationFrom ? 45 : 25,
          notes: `Auto-created following transfer of ${action.payload.patientName} to ${toBed.bedNumber}.`,
        });

        // Recalculate ward counts
        state.wards.forEach((ward) => {
          ward.occupiedBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Occupied").length;
          ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
        });

        // Log atomic history entries
        state.history.unshift({
          id: `hist_${Date.now()}_out`,
          bedId: fromBed.id,
          bedNumber: fromBed.bedNumber,
          wardName: fromBed.wardName,
          eventType: "Transfer Out",
          patientName: action.payload.patientName,
          staffName: action.payload.transferredBy,
          timestamp: new Date().toISOString(),
          details: `Transferred patient out to ${toBed.bedNumber} (${toBed.wardName}). Origin bed moved to Cleaning.`,
        });

        state.history.unshift({
          id: `hist_${Date.now()}_in`,
          bedId: toBed.id,
          bedNumber: toBed.bedNumber,
          wardName: toBed.wardName,
          eventType: "Transfer In",
          patientName: action.payload.patientName,
          staffName: action.payload.transferredBy,
          timestamp: new Date().toISOString(),
          details: `Transferred patient in from ${fromBed.bedNumber} (${fromBed.wardName}). Bed status Occupied.`,
        });
      }
    },

    // 5. CLEANING TASK WORKFLOW
    assignCleaningStaff: (
      state,
      action: PayloadAction<{ taskId: string; staffId: string; staffName: string }>
    ) => {
      const task = state.cleaningTasks.find((t) => t.id === action.payload.taskId);
      if (task) {
        task.assignedStaffId = action.payload.staffId;
        task.assignedStaffName = action.payload.staffName;
        task.status = "In Progress";
      }
    },

    completeCleaningTask: (
      state,
      action: PayloadAction<{ taskId: string; completedBy: string }>
    ) => {
      const task = state.cleaningTasks.find((t) => t.id === action.payload.taskId);
      if (task) {
        task.status = "Done";
        task.completedAt = new Date().toISOString();

        const bed = state.beds.find((b) => b.id === task.bedId);
        if (bed) {
          bed.status = "Available";
          bed.turnoverETA = undefined;

          const ward = state.wards.find((w) => w.id === bed.wardId);
          if (ward) {
            ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
          }

          state.history.unshift({
            id: `hist_${Date.now()}`,
            bedId: bed.id,
            bedNumber: bed.bedNumber,
            wardName: bed.wardName,
            eventType: "Cleaning Completed",
            staffName: action.payload.completedBy,
            timestamp: new Date().toISOString(),
            details: `Completed ${task.protocol} protocol. Bed certified sanitized & Available.`,
          });
        }
      }
    },

    // 6. RESERVATIONS
    reserveBed: (
      state,
      action: PayloadAction<{
        bedId: string;
        patientName: string;
        expiryISO: string;
        reservedBy: string;
      }>
    ) => {
      const bed = state.beds.find((b) => b.id === action.payload.bedId);
      if (bed && bed.status === "Available") {
        bed.status = "Reserved";
        bed.reservedForPatientName = action.payload.patientName;
        bed.reservedExpiry = action.payload.expiryISO;

        const ward = state.wards.find((w) => w.id === bed.wardId);
        if (ward) {
          ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
        }

        state.history.unshift({
          id: `hist_${Date.now()}`,
          bedId: bed.id,
          bedNumber: bed.bedNumber,
          wardName: bed.wardName,
          eventType: "Reservation",
          patientName: action.payload.patientName,
          staffName: action.payload.reservedBy,
          timestamp: new Date().toISOString(),
          details: `Bed reserved until ${new Date(action.payload.expiryISO).toLocaleString()}`,
        });
      }
    },

    cancelReservation: (state, action: PayloadAction<string>) => {
      const bed = state.beds.find((b) => b.id === action.payload);
      if (bed && bed.status === "Reserved") {
        const former = bed.reservedForPatientName;
        bed.status = "Available";
        bed.reservedForPatientName = undefined;
        bed.reservedExpiry = undefined;

        const ward = state.wards.find((w) => w.id === bed.wardId);
        if (ward) {
          ward.availableBeds = state.beds.filter((b) => b.wardId === ward.id && b.status === "Available").length;
        }

        state.history.unshift({
          id: `hist_${Date.now()}`,
          bedId: bed.id,
          bedNumber: bed.bedNumber,
          wardName: bed.wardName,
          eventType: "Reservation",
          patientName: former,
          staffName: "Hospital Admin",
          timestamp: new Date().toISOString(),
          details: `Reservation cancelled. Bed returned to Available status.`,
        });
      }
    },
  },
});

export const {
  hydrateWardsBedsState,
  addWard,
  updateWard,
  deactivateWard,
  allocateBed,
  releaseBed,
  executeBedTransfer,
  assignCleaningStaff,
  completeCleaningTask,
  reserveBed,
  cancelReservation,
} = wardsBedsSlice.actions;

export default wardsBedsSlice.reducer;
