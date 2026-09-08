import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SurgicalCaseStatus = 'Planning' | 'Ready' | 'Blocked' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
export type ChecklistItemStatus = 'Pending' | 'Done' | 'Missing' | 'Overdue' | 'Waived - Emergency Override';
export type SurgeonRequestStatus = 'Sent' | 'Accepted' | 'Declined' | 'Clarification Requested' | 'Assigned' | 'Expired';
export type OTRoomStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Cleaning-Turnover' | 'Decommissioned';

export interface ChecklistItem {
  id: string;
  category: 'pre-op assessment' | 'investigations' | 'consent' | 'blood/implant/equipment' | 'other configured dependencies';
  description: string;
  status: ChecklistItemStatus;
  owner: string;
  deadline: string;
  isLifeCritical?: boolean;
  waiverReason?: string;
  waivedBy?: string;
}

export interface SurgeonResponse {
  surgeonId: string;
  surgeonName: string;
  status: SurgeonRequestStatus;
  responseNotes?: string;
  respondedAt?: string;
}

export interface SurgeonRequest {
  id: string;
  caseId: string;
  specialty: string;
  subSpecialty: string;
  caseType: string;
  requiredTime: string;
  location: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
  permittedCaseDetails: string;
  readinessInfo: string;
  sentAt: string;
  status: SurgeonRequestStatus;
  responses: SurgeonResponse[];
}

export interface OTRoom {
  id: string;
  name: string;
  department: string;
  status: OTRoomStatus;
  baseEquipment: string[];
  currentCaseId?: string;
  turnoverETA?: string;
  maintenanceWindow?: {
    startDate: string;
    endDate: string;
    reason: string;
  };
  utilizationStats: {
    totalSurgeries: number;
    avgTurnoverMins: number;
    occupancyRate: number;
  };
}

export interface Surgeon {
  id: string;
  name: string;
  specialty: string;
  availability: 'Available' | 'In Surgery' | 'Off-duty';
  reliabilityScore: number;
  acceptedCases: number;
  avgResponseTimeMins: number;
  isInternal: boolean;
}

export interface SurgicalTeamTemplate {
  id: string;
  name: string;
  specialty: string;
  leadSurgeon: string;
  anesthetist: string;
  scrubNurse: string;
  circulatingNurse: string;
}

export interface PostOpTask {
  id: string;
  task: string;
  status: 'Pending' | 'Completed';
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface PostOpRecoveryRecord {
  caseId: string;
  patientName: string;
  procedureType: string;
  surgeonName: string;
  pacuBed: string;
  admittedToPACU: string;
  vitalsStatus: 'Stable' | 'Critical' | 'Guarded';
  drainOutput: string;
  icuHandoverReady: boolean;
  targetIcuBed?: string;
  medicationOrdersGiven: boolean;
  status: 'In Recovery' | 'Transferred to ICU' | 'Shifted to Ward' | 'Discharged';
}

export interface SurgeryHistoryRecord {
  id: string;
  caseId: string;
  patientId: string;
  patientName: string;
  procedureType: string;
  department: string;
  surgeonName: string;
  roomName: string;
  date: string;
  durationMins: number;
  outcome: 'Successful' | 'Completed with Complications' | 'Cancelled';
  complications?: string;
  postOpSummary: string;
  team: string[];
}

export interface SurgicalCase {
  id: string;
  patientId: string;
  patientName: string;
  procedureType: string;
  department: string;
  preferredDateTime: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
  status: SurgicalCaseStatus;
  readinessPercent: number;
  checklist: ChecklistItem[];
  allocatedOT?: {
    roomId: string;
    startDateTime: string;
    endDateTime: string;
    team: string[];
    resources: string[];
  };
  assignedSurgeonId?: string;
  assignedSurgeonName?: string;
  isExternalSurgeon?: boolean;
  surgeonAccessExpiresAt?: string;
  linkedProcurementIds: string[];
  postOpTasks: PostOpTask[];
  postOpRecovery?: PostOpRecoveryRecord;
  isEmergencyOverride?: boolean;
}

export interface SurgicalState {
  cases: SurgicalCase[];
  otRooms: OTRoom[];
  surgeons: Surgeon[];
  surgeonRequests: SurgeonRequest[];
  teamTemplates: SurgicalTeamTemplate[];
  history: SurgeryHistoryRecord[];
}

const mockSurgeons: Surgeon[] = [
  { id: 'SURG-01', name: 'Dr. Ramesh Sharma', specialty: 'Orthopedics', availability: 'Available', reliabilityScore: 98, acceptedCases: 45, avgResponseTimeMins: 12, isInternal: true },
  { id: 'SURG-02', name: 'Dr. Kavita Verma', specialty: 'Neurology', availability: 'In Surgery', reliabilityScore: 95, acceptedCases: 112, avgResponseTimeMins: 15, isInternal: true },
  { id: 'EXT-01', name: 'Dr. Anand Iyer', specialty: 'Cardiology', availability: 'Available', reliabilityScore: 89, acceptedCases: 22, avgResponseTimeMins: 45, isInternal: false },
  { id: 'EXT-02', name: 'Dr. Sunita Patel', specialty: 'Orthopedics', availability: 'Available', reliabilityScore: 92, acceptedCases: 34, avgResponseTimeMins: 30, isInternal: false },
  { id: 'SURG-03', name: 'Dr. Vikram Seth', specialty: 'Neurosurgery', availability: 'Available', reliabilityScore: 97, acceptedCases: 78, avgResponseTimeMins: 18, isInternal: true },
  { id: 'SURG-04', name: 'Dr. Rohan Mehta', specialty: 'General Surgery', availability: 'Available', reliabilityScore: 96, acceptedCases: 94, avgResponseTimeMins: 14, isInternal: true },
];

const mockRooms: OTRoom[] = [
  {
    id: 'OT-101',
    name: 'Main OR 1 (Ortho & Trauma)',
    department: 'Orthopedics',
    status: 'Available',
    baseEquipment: ['C-Arm Mobile Radiography', 'Orthopedic Traction Table', 'Pneumatic Tourniquet', 'Electro-Cautery Generator'],
    utilizationStats: { totalSurgeries: 142, avgTurnoverMins: 24, occupancyRate: 78 }
  },
  {
    id: 'OT-102',
    name: 'Main OR 2 (Neuro & Spine)',
    department: 'Neurology',
    status: 'Occupied',
    currentCaseId: 'CASE-409',
    baseEquipment: ['Carl Zeiss OPMI Pentero Microscope', 'Neuro-Navigation System', 'High-Speed Drill Unit', 'Cranial Stabilization Frame'],
    utilizationStats: { totalSurgeries: 98, avgTurnoverMins: 32, occupancyRate: 85 }
  },
  {
    id: 'OT-103',
    name: 'Cardiac Hybrid OR 3',
    department: 'Cardiology',
    status: 'Available',
    baseEquipment: ['Heart-Lung Machine (CPB)', 'Intra-Aortic Balloon Pump (IABP)', 'Transesophageal Echo (TEE)', 'ACT Coagulation Timer'],
    utilizationStats: { totalSurgeries: 76, avgTurnoverMins: 38, occupancyRate: 71 }
  },
  {
    id: 'OT-201',
    name: 'General OR 1 (Laparoscopy Suite)',
    department: 'General Surgery',
    status: 'Cleaning-Turnover',
    turnoverETA: '15 mins',
    baseEquipment: ['Karl Storz 4K Laparoscopic Tower', 'Harmonic Scalpel', 'Insufflator', 'LED Surgical Lights'],
    utilizationStats: { totalSurgeries: 185, avgTurnoverMins: 20, occupancyRate: 82 }
  },
  {
    id: 'OT-202',
    name: 'Emergency Fast-Track OT',
    department: 'Emergency',
    status: 'Available',
    baseEquipment: ['Rapid Infuser / Blood Warmer', 'Crash Cart Multipara', 'Defibrillator', 'Emergency Tracheostomy Set'],
    utilizationStats: { totalSurgeries: 210, avgTurnoverMins: 18, occupancyRate: 64 }
  },
  {
    id: 'OT-203',
    name: 'Day Surgery OR 2',
    department: 'General Surgery',
    status: 'Maintenance',
    baseEquipment: ['Electro-cautery Unit', 'Anesthesia Workstation', 'Minor OT Instrument Set'],
    maintenanceWindow: {
      startDate: '2026-08-20T00:00:00Z',
      endDate: '2026-08-23T23:59:59Z',
      reason: 'HEPA Filter Replacement & Laminar Flow Recalibration'
    },
    utilizationStats: { totalSurgeries: 64, avgTurnoverMins: 25, occupancyRate: 45 }
  }
];

const mockTeamTemplates: SurgicalTeamTemplate[] = [
  {
    id: 'TPL-01',
    name: 'Orthopedic Major Joint Team',
    specialty: 'Orthopedics',
    leadSurgeon: 'Dr. Ramesh Sharma',
    anesthetist: 'Dr. Rajesh Menon',
    scrubNurse: 'Sister Kamala Rao',
    circulatingNurse: 'Nurse Suman Das'
  },
  {
    id: 'TPL-02',
    name: 'Neurovascular Cranial Team',
    specialty: 'Neurology',
    leadSurgeon: 'Dr. Vikram Seth',
    anesthetist: 'Dr. Sunita Deshmukh',
    scrubNurse: 'Sister Zoya Ansari',
    circulatingNurse: 'Nurse Kiran More'
  },
  {
    id: 'TPL-03',
    name: 'Emergency Trauma Fast-Response Team',
    specialty: 'Emergency',
    leadSurgeon: 'Dr. Rohan Mehta',
    anesthetist: 'Dr. Arvind Joshi',
    scrubNurse: 'Sister Anjali Bhosale',
    circulatingNurse: 'Nurse Vikram Pawar'
  }
];

const mockHistory: SurgeryHistoryRecord[] = [
  {
    id: 'HIST-101',
    caseId: 'CASE-398',
    patientId: 'P-7712',
    patientName: 'Meera Nambiar',
    procedureType: 'Elective Laparoscopic Cholecystectomy',
    department: 'General Surgery',
    surgeonName: 'Dr. Rohan Mehta',
    roomName: 'General OR 1 (Laparoscopy Suite)',
    date: '2026-08-18',
    durationMins: 65,
    outcome: 'Successful',
    postOpSummary: 'Uneventful procedure. Gallbladder excised intact without spillage. PACU recovery smooth.',
    team: ['Dr. Rohan Mehta (Surgeon)', 'Dr. Rajesh Menon (Anesthesia)', 'Sister Kamala Rao (Scrub)']
  },
  {
    id: 'HIST-102',
    caseId: 'CASE-395',
    patientId: 'P-6520',
    patientName: 'Mohan Das',
    procedureType: 'Right Femoral Hernioplasty with Mesh',
    department: 'General Surgery',
    surgeonName: 'Dr. Rohan Mehta',
    roomName: 'Main OR 1 (Ortho & Trauma)',
    date: '2026-08-16',
    durationMins: 80,
    outcome: 'Successful',
    postOpSummary: 'Prolene mesh placed and anchored. Hemostasis achieved. Shifted to Day-care Recovery.',
    team: ['Dr. Rohan Mehta (Surgeon)', 'Dr. Sunita Deshmukh (Anesthesia)', 'Nurse Suman Das (Scrub)']
  },
  {
    id: 'HIST-103',
    caseId: 'CASE-391',
    patientId: 'P-5411',
    patientName: 'Pooja Hegde',
    procedureType: 'Arthroscopic ACL Reconstruction',
    department: 'Orthopedics',
    surgeonName: 'Dr. Ramesh Sharma',
    roomName: 'Main OR 1 (Ortho & Trauma)',
    date: '2026-08-14',
    durationMins: 110,
    outcome: 'Successful',
    postOpSummary: 'Hamstring autograft secured with bioabsorbable interference screw. Lachman negative post-fixation.',
    team: ['Dr. Ramesh Sharma (Surgeon)', 'Dr. Rajesh Menon (Anesthesia)', 'Sister Kamala Rao (Scrub)']
  }
];

const initialState: SurgicalState = {
  cases: [
    {
      id: 'CASE-409',
      patientId: 'P-8821',
      patientName: 'Arjun Gupta',
      procedureType: 'Total Knee Replacement (Left)',
      department: 'Orthopedics',
      preferredDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
      urgency: 'Routine',
      status: 'Blocked',
      readinessPercent: 75,
      checklist: [
        { id: 'C1', category: 'pre-op assessment', description: 'Cardiology Clearance & ECG', status: 'Done', owner: 'Dr. Menon', deadline: '2026-08-20', isLifeCritical: true },
        { id: 'C2', category: 'consent', description: 'Informed Surgical & High-Risk Consent', status: 'Done', owner: 'Nurse Kamala', deadline: '2026-08-20', isLifeCritical: false },
        { id: 'C3', category: 'blood/implant/equipment', description: 'Titanium Knee Joint Implant (Size 4L)', status: 'Missing', owner: 'Procurement Desk', deadline: '2026-08-21', isLifeCritical: false },
        { id: 'C4', category: 'pre-op assessment', description: 'Pre-Anesthesia Checkup (PAC) Form', status: 'Done', owner: 'Dr. Reddy', deadline: '2026-08-20', isLifeCritical: true },
      ],
      linkedProcurementIds: ['PR-1002'],
      postOpTasks: [
        { id: 'PO-1', task: 'PACU Vitals every 15 mins for 2 hours', status: 'Pending' },
        { id: 'PO-2', task: 'Surgical drain output monitoring (Hemovac)', status: 'Pending' },
        { id: 'PO-3', task: 'Post-op analgesia infusion protocol initiated', status: 'Pending' },
      ],
      postOpRecovery: {
        caseId: 'CASE-409',
        patientName: 'Arjun Gupta',
        procedureType: 'Total Knee Replacement (Left)',
        surgeonName: 'Dr. Ramesh Sharma',
        pacuBed: 'PACU Bay 02',
        admittedToPACU: '2026-08-21T13:30:00Z',
        vitalsStatus: 'Stable',
        drainOutput: '45 mL serosanguinous',
        icuHandoverReady: false,
        medicationOrdersGiven: true,
        status: 'In Recovery'
      }
    },
    {
      id: 'CASE-410',
      patientId: 'P-9102',
      patientName: 'Kavita Patil',
      procedureType: 'Lumbar Microdiscectomy (L4-L5)',
      department: 'Neurology',
      preferredDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      urgency: 'Routine',
      status: 'Scheduled',
      readinessPercent: 100,
      assignedSurgeonId: 'SURG-03',
      assignedSurgeonName: 'Dr. Vikram Seth',
      allocatedOT: {
        roomId: 'OT-102',
        startDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        endDateTime: new Date(Date.now() + 1000 * 60 * 60 * 26 * 2).toISOString(),
        team: ['Dr. Vikram Seth (Lead)', 'Dr. Sunita Deshmukh (Anesth)', 'Sister Zoya Ansari'],
        resources: ['Pentero Microscope', 'Neuro Drill']
      },
      checklist: [
        { id: 'C10-1', category: 'pre-op assessment', description: 'PAC Clearance Complete', status: 'Done', owner: 'Anesthesia Team', deadline: '2026-08-20', isLifeCritical: true },
        { id: 'C10-2', category: 'consent', description: 'Signed Surgical Consent', status: 'Done', owner: 'Ward Sister', deadline: '2026-08-20', isLifeCritical: false },
        { id: 'C10-3', category: 'investigations', description: 'Spine MRI & Coagulation Profile', status: 'Done', owner: 'Radiology / Lab', deadline: '2026-08-20', isLifeCritical: false },
        { id: 'C10-4', category: 'blood/implant/equipment', description: 'Micro-Discectomy Tray Verified', status: 'Done', owner: 'CSSD Sterile', deadline: '2026-08-20', isLifeCritical: false },
      ],
      linkedProcurementIds: [],
      postOpTasks: []
    },
    {
      id: 'CASE-411',
      patientId: 'P-3341',
      patientName: 'Suresh Kulkarni',
      procedureType: 'Coronary Artery Bypass Graft (CABG x3)',
      department: 'Cardiology',
      preferredDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      urgency: 'Urgent',
      status: 'Ready',
      readinessPercent: 100,
      assignedSurgeonId: 'EXT-01',
      assignedSurgeonName: 'Dr. Anand Iyer',
      isExternalSurgeon: true,
      surgeonAccessExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      checklist: [
        { id: 'C11-1', category: 'pre-op assessment', description: 'Cardiac Clearance & Echo', status: 'Done', owner: 'Dr. Anand Iyer', deadline: '2026-08-20', isLifeCritical: true },
        { id: 'C11-2', category: 'investigations', description: 'Blood Cross-Matching (4 PRBC reserved)', status: 'Done', owner: 'Blood Bank', deadline: '2026-08-20', isLifeCritical: true },
        { id: 'C11-3', category: 'consent', description: 'High Risk Open-Heart Consent', status: 'Done', owner: 'Admin Desk', deadline: '2026-08-20', isLifeCritical: false },
        { id: 'C11-4', category: 'blood/implant/equipment', description: 'Heart-Lung Bypass Machine Ready', status: 'Done', owner: 'Perfusionist Satish', deadline: '2026-08-20', isLifeCritical: false },
      ],
      linkedProcurementIds: [],
      postOpTasks: []
    }
  ],
  otRooms: mockRooms,
  surgeons: mockSurgeons,
  surgeonRequests: [],
  teamTemplates: mockTeamTemplates,
  history: mockHistory
};

// Helper to compute readiness and update blockers
const evaluateCaseReadiness = (c: SurgicalCase) => {
  if (c.checklist.length === 0) {
    c.readinessPercent = 100;
    if (c.status === 'Blocked' || c.status === 'Planning') c.status = 'Ready';
    return;
  }
  const doneCount = c.checklist.filter(i => i.status === 'Done' || i.status === 'Waived - Emergency Override').length;
  c.readinessPercent = Math.round((doneCount / c.checklist.length) * 100);
  
  const hasMissingOrOverdue = c.checklist.some(i => i.status === 'Missing' || i.status === 'Overdue');
  
  if (c.readinessPercent === 100 && !hasMissingOrOverdue) {
    if (c.status === 'Blocked' || c.status === 'Planning') {
      c.status = 'Ready';
    }
  } else if (hasMissingOrOverdue) {
    c.status = 'Blocked';
  } else if (c.status === 'Ready') {
    c.status = 'Planning';
  }
};

const surgicalSlice = createSlice({
  name: 'surgical',
  initialState,
  reducers: {
    hydrateSurgicalState: (state, action: PayloadAction<Partial<SurgicalState>>) => {
      if (action.payload.cases) state.cases = action.payload.cases;
      if (action.payload.otRooms) state.otRooms = action.payload.otRooms;
      if (action.payload.surgeons) state.surgeons = action.payload.surgeons;
      if (action.payload.surgeonRequests) state.surgeonRequests = action.payload.surgeonRequests;
      if (action.payload.teamTemplates) state.teamTemplates = action.payload.teamTemplates;
      if (action.payload.history) state.history = action.payload.history;
    },

    // Case creation
    createCase: (state, action: PayloadAction<Partial<SurgicalCase>>) => {
      const newCase: SurgicalCase = {
        id: `CASE-${400 + state.cases.length + 15}`,
        patientId: action.payload.patientId || `P-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: action.payload.patientName || 'Unknown Patient',
        procedureType: action.payload.procedureType || 'General Surgical Procedure',
        department: action.payload.department || 'General Surgery',
        preferredDateTime: action.payload.preferredDateTime || new Date().toISOString(),
        urgency: action.payload.urgency || 'Routine',
        status: 'Planning',
        readinessPercent: 0,
        checklist: [
          { id: 'C1', category: 'pre-op assessment', description: 'Pre-Anesthetic Checkup (PAC)', status: 'Pending', owner: 'Anesthesia Dept', deadline: action.payload.preferredDateTime || new Date().toISOString(), isLifeCritical: true },
          { id: 'C2', category: 'investigations', description: 'CBC, PT/INR & Viral Markers', status: 'Pending', owner: 'Central Lab', deadline: action.payload.preferredDateTime || new Date().toISOString(), isLifeCritical: false },
          { id: 'C3', category: 'consent', description: 'Informed Surgical & Anesthesia Consent', status: 'Pending', owner: 'Admin / Ward Sister', deadline: action.payload.preferredDateTime || new Date().toISOString(), isLifeCritical: false },
          { id: 'C4', category: 'blood/implant/equipment', description: 'Blood Availability & Cross-Match', status: 'Pending', owner: 'Blood Bank', deadline: action.payload.preferredDateTime || new Date().toISOString(), isLifeCritical: true },
        ],
        linkedProcurementIds: action.payload.linkedProcurementIds || [],
        postOpTasks: []
      };
      state.cases.unshift(newCase);
    },

    // Fast-Track Emergency Surgery Creation
    createEmergencySurgery: (
      state,
      action: PayloadAction<{
        patientName: string;
        procedureType: string;
        department: string;
        roomId: string;
        authorizingDoctor: string;
        overrideReason: string;
        team: string[];
      }>
    ) => {
      const { patientName, procedureType, department, roomId, authorizingDoctor, overrideReason, team } = action.payload;
      const targetRoom = state.otRooms.find(r => r.id === roomId) || state.otRooms[0];
      
      const newCase: SurgicalCase = {
        id: `CASE-EMG-${Math.floor(100 + Math.random() * 900)}`,
        patientId: `P-EMG-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName,
        procedureType,
        department,
        preferredDateTime: new Date().toISOString(),
        urgency: 'Emergency',
        status: 'Scheduled',
        readinessPercent: 100,
        isEmergencyOverride: true,
        allocatedOT: {
          roomId: targetRoom.id,
          startDateTime: new Date().toISOString(),
          endDateTime: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
          team,
          resources: ['Emergency Laparotomy Set', 'Rapid Blood Warmer']
        },
        checklist: [
          { id: 'EC1', category: 'pre-op assessment', description: 'Emergency Anesthesia Rapid Induction Assessment', status: 'Done', owner: authorizingDoctor, deadline: new Date().toISOString(), isLifeCritical: true },
          { id: 'EC2', category: 'blood/implant/equipment', description: 'Emergency O-Neg / Uncrossed Blood Units Reserved', status: 'Done', owner: 'Blood Bank', deadline: new Date().toISOString(), isLifeCritical: true },
          { id: 'EC3', category: 'investigations', description: 'Routine Non-Critical Diagnostics (Waived)', status: 'Waived - Emergency Override', owner: authorizingDoctor, deadline: new Date().toISOString(), isLifeCritical: false, waiverReason: overrideReason, waivedBy: authorizingDoctor },
          { id: 'EC4', category: 'consent', description: 'Emergency Life-Saving Waiver of Written Consent', status: 'Waived - Emergency Override', owner: authorizingDoctor, deadline: new Date().toISOString(), isLifeCritical: false, waiverReason: overrideReason, waivedBy: authorizingDoctor },
        ],
        linkedProcurementIds: [],
        postOpTasks: []
      };

      // Mark OT room as occupied
      if (targetRoom) {
        targetRoom.status = 'Occupied';
        targetRoom.currentCaseId = newCase.id;
      }

      state.cases.unshift(newCase);
    },

    // Checklist toggles
    updateChecklistItem: (state, action: PayloadAction<{ caseId: string, itemId: string, status: ChecklistItemStatus }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        const item = c.checklist.find(i => i.id === action.payload.itemId);
        if (item) {
          item.status = action.payload.status;
          evaluateCaseReadiness(c);
        }
      }
    },

    // Waive checklist item with reason and authorizer
    waiveChecklistItem: (
      state,
      action: PayloadAction<{
        caseId: string;
        itemId: string;
        reason: string;
        authorizedBy: string;
      }>
    ) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        const item = c.checklist.find(i => i.id === action.payload.itemId);
        if (item) {
          if (item.isLifeCritical) {
            // Cannot waive life critical
            return;
          }
          item.status = 'Waived - Emergency Override';
          item.waiverReason = action.payload.reason;
          item.waivedBy = action.payload.authorizedBy;
          evaluateCaseReadiness(c);
        }
      }
    },

    // Surgeon assignments
    assignInternalSurgeon: (state, action: PayloadAction<{ caseId: string, surgeonId: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      const s = state.surgeons.find(s => s.id === action.payload.surgeonId);
      if (c && s) {
        c.assignedSurgeonId = s.id;
        c.assignedSurgeonName = s.name;
        c.isExternalSurgeon = false;
        c.surgeonAccessExpiresAt = undefined;
      }
    },
    grantExternalSurgeonAccess: (state, action: PayloadAction<{ caseId: string, surgeonId: string, expiresAt: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      const s = state.surgeons.find(s => s.id === action.payload.surgeonId);
      if (c && s) {
        c.assignedSurgeonId = s.id;
        c.assignedSurgeonName = s.name;
        c.isExternalSurgeon = true;
        c.surgeonAccessExpiresAt = action.payload.expiresAt;
      }
    },

    // OT Slot allocation
    allocateOT: (state, action: PayloadAction<{ caseId: string, roomId: string, startDateTime: string, endDateTime: string, team: string[], resources: string[] }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        c.allocatedOT = {
          roomId: action.payload.roomId,
          startDateTime: action.payload.startDateTime,
          endDateTime: action.payload.endDateTime,
          team: action.payload.team,
          resources: action.payload.resources
        };
        c.status = 'Scheduled';

        // Update room status
        const room = state.otRooms.find(r => r.id === action.payload.roomId);
        if (room && room.status === 'Available') {
          room.currentCaseId = c.id;
        }
      }
    },

    // Reassign OT slot
    reassignOTSlot: (state, action: PayloadAction<{ caseId: string, roomId: string, startDateTime: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c && c.allocatedOT) {
        c.allocatedOT.roomId = action.payload.roomId;
        c.allocatedOT.startDateTime = action.payload.startDateTime;
      }
    },

    // OT Rooms Management
    addOTRoom: (state, action: PayloadAction<Omit<OTRoom, 'id' | 'utilizationStats'>>) => {
      const newRoom: OTRoom = {
        id: `OT-${100 + state.otRooms.length + 1}`,
        ...action.payload,
        utilizationStats: { totalSurgeries: 0, avgTurnoverMins: 20, occupancyRate: 0 }
      };
      state.otRooms.push(newRoom);
    },
    updateOTRoom: (state, action: PayloadAction<OTRoom>) => {
      const idx = state.otRooms.findIndex(r => r.id === action.payload.id);
      if (idx !== -1) {
        state.otRooms[idx] = action.payload;
      }
    },
    deleteOTRoom: (state, action: PayloadAction<string>) => {
      state.otRooms = state.otRooms.filter(r => r.id !== action.payload);
    },
    scheduleOTMaintenance: (state, action: PayloadAction<{ roomId: string; startDate: string; endDate: string; reason: string }>) => {
      const room = state.otRooms.find(r => r.id === action.payload.roomId);
      if (room) {
        room.status = 'Maintenance';
        room.maintenanceWindow = {
          startDate: action.payload.startDate,
          endDate: action.payload.endDate,
          reason: action.payload.reason
        };
      }
    },

    // Team Templates
    addTeamTemplate: (state, action: PayloadAction<Omit<SurgicalTeamTemplate, 'id'>>) => {
      const newTemplate: SurgicalTeamTemplate = {
        id: `TPL-0${state.teamTemplates.length + 1}`,
        ...action.payload
      };
      state.teamTemplates.push(newTemplate);
    },
    deleteTeamTemplate: (state, action: PayloadAction<string>) => {
      state.teamTemplates = state.teamTemplates.filter(t => t.id !== action.payload);
    },

    // Complete Surgery -> Archive into History
    completeSurgery: (
      state,
      action: PayloadAction<{
        caseId: string;
        durationMins: number;
        outcome: 'Successful' | 'Completed with Complications' | 'Cancelled';
        postOpSummary: string;
        complications?: string;
      }>
    ) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        c.status = 'Completed';
        const historyEntry: SurgeryHistoryRecord = {
          id: `HIST-${100 + state.history.length + 1}`,
          caseId: c.id,
          patientId: c.patientId,
          patientName: c.patientName,
          procedureType: c.procedureType,
          department: c.department,
          surgeonName: c.assignedSurgeonName || 'Assigned Surgeon',
          roomName: c.allocatedOT ? c.allocatedOT.roomId : 'OT Room',
          date: new Date().toISOString().split('T')[0],
          durationMins: action.payload.durationMins,
          outcome: action.payload.outcome,
          complications: action.payload.complications,
          postOpSummary: action.payload.postOpSummary,
          team: c.allocatedOT ? c.allocatedOT.team : []
        };
        state.history.unshift(historyEntry);

        // Free up the OT room to cleaning turnover
        if (c.allocatedOT) {
          const room = state.otRooms.find(r => r.id === c.allocatedOT?.roomId);
          if (room) {
            room.status = 'Cleaning-Turnover';
            room.turnoverETA = '20 mins';
            room.currentCaseId = undefined;
            room.utilizationStats.totalSurgeries += 1;
          }
        }
      }
    },

    // Cancel Surgery
    cancelSurgery: (state, action: PayloadAction<{ caseId: string; reason: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        c.status = 'Cancelled';
        state.history.unshift({
          id: `HIST-${100 + state.history.length + 1}`,
          caseId: c.id,
          patientId: c.patientId,
          patientName: c.patientName,
          procedureType: c.procedureType,
          department: c.department,
          surgeonName: c.assignedSurgeonName || 'Unassigned',
          roomName: c.allocatedOT ? c.allocatedOT.roomId : 'Unallocated',
          date: new Date().toISOString().split('T')[0],
          durationMins: 0,
          outcome: 'Cancelled',
          postOpSummary: `Surgery cancelled: ${action.payload.reason}`,
          team: c.allocatedOT ? c.allocatedOT.team : []
        });

        // Free up OT room if allocated
        if (c.allocatedOT) {
          const room = state.otRooms.find(r => r.id === c.allocatedOT?.roomId);
          if (room && room.currentCaseId === c.id) {
            room.status = 'Available';
            room.currentCaseId = undefined;
          }
        }
      }
    },

    // Post-Op Recovery Updates
    updatePostOpRecovery: (state, action: PayloadAction<Partial<PostOpRecoveryRecord> & { caseId: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c && c.postOpRecovery) {
        c.postOpRecovery = {
          ...c.postOpRecovery,
          ...action.payload
        };
      }
    },

    // Surgeon Requests Dispatch & Response Management
    createSurgeonRequest: (
      state,
      action: PayloadAction<{
        caseId: string;
        specialty: string;
        subSpecialty: string;
        caseType: string;
        requiredTime: string;
        location: string;
        urgency: 'Routine' | 'Urgent' | 'Emergency';
        eligibleSurgeonIds: string[];
      }>
    ) => {
      const { caseId, specialty, subSpecialty, caseType, requiredTime, location, urgency, eligibleSurgeonIds } = action.payload;
      const c = state.cases.find(c => c.id === caseId);

      const newRequest: SurgeonRequest = {
        id: `REQ-${Date.now().toString().slice(-4)}`,
        caseId,
        specialty,
        subSpecialty,
        caseType,
        requiredTime,
        location,
        urgency,
        permittedCaseDetails: `Patient: ${c ? c.patientName.slice(0, 1) + '***' : 'Anonymous'} | Procedure: ${caseType}`,
        readinessInfo: `Pre-op Readiness: ${c ? c.readinessPercent : 0}%`,
        sentAt: new Date().toISOString(),
        status: 'Sent',
        responses: eligibleSurgeonIds.map(surgeonId => {
          const s = state.surgeons.find(s => s.id === surgeonId);
          return {
            surgeonId,
            surgeonName: s ? s.name : surgeonId,
            status: 'Sent'
          };
        })
      };

      state.surgeonRequests.unshift(newRequest);
    },

    updateSurgeonResponse: (
      state,
      action: PayloadAction<{
        requestId: string;
        surgeonId: string;
        status: SurgeonRequestStatus;
        responseNotes?: string;
      }>
    ) => {
      const req = state.surgeonRequests.find(r => r.id === action.payload.requestId);
      if (req) {
        const resp = req.responses.find(r => r.surgeonId === action.payload.surgeonId);
        if (resp) {
          resp.status = action.payload.status;
          resp.responseNotes = action.payload.responseNotes;
          resp.respondedAt = new Date().toISOString();
        }
      }
    },

    assignExternalSurgeonFromRequest: (
      state,
      action: PayloadAction<{
        requestId: string;
        surgeonId: string;
        expiresAt: string;
      }>
    ) => {
      const req = state.surgeonRequests.find(r => r.id === action.payload.requestId);
      if (req) {
        req.status = 'Assigned';
        const resp = req.responses.find(r => r.surgeonId === action.payload.surgeonId);
        if (resp) resp.status = 'Assigned';

        const c = state.cases.find(c => c.id === req.caseId);
        const s = state.surgeons.find(s => s.id === action.payload.surgeonId);
        if (c && s) {
          c.assignedSurgeonId = s.id;
          c.assignedSurgeonName = s.name;
          c.isExternalSurgeon = true;
          c.surgeonAccessExpiresAt = action.payload.expiresAt;
        }
      }
    },

    // Post-op task toggle
    togglePostOpTask: (state, action: PayloadAction<{ caseId: string; taskId: string }>) => {
      const c = state.cases.find(c => c.id === action.payload.caseId);
      if (c) {
        const task = c.postOpTasks.find(t => t.id === action.payload.taskId);
        if (task) {
          task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
        }
      }
    }
  }
});

export const {
  hydrateSurgicalState,
  createCase,
  createEmergencySurgery,
  updateChecklistItem,
  waiveChecklistItem,
  assignInternalSurgeon,
  grantExternalSurgeonAccess,
  allocateOT,
  reassignOTSlot,
  addOTRoom,
  updateOTRoom,
  deleteOTRoom,
  scheduleOTMaintenance,
  addTeamTemplate,
  deleteTeamTemplate,
  completeSurgery,
  cancelSurgery,
  updatePostOpRecovery,
  createSurgeonRequest,
  updateSurgeonResponse,
  assignExternalSurgeonFromRequest,
  togglePostOpTask
} = surgicalSlice.actions;

export default surgicalSlice.reducer;
