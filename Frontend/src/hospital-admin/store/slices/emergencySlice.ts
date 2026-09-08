import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type EmergencyStatus =
  | 'SOS Created'
  | 'Hospital Notified'
  | 'Acknowledged'
  | 'Ambulance Dispatched'
  | 'Pre-Arrival'
  | 'Arrived'
  | 'Closed';

export type EmergencyPriority = 'Critical' | 'High' | 'Medium';
export type DeliveryState = 'Delivered' | 'Pending Ack' | 'Escalated';
export type FlowType = 'Flow A (Active Relationship)' | 'Flow B (Location Routing)';

export interface EmergencyCase {
  id: string;
  patientName: string;
  location: string;
  destinationHospital: string;
  originalHospital?: string;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  deliveryState: DeliveryState;
  flowType: FlowType;
  createdAt: string;
  slaBreached: boolean;
  assignedTeam?: string;
  fallbackTriggered?: boolean;
  fallbackHospital?: string;
  ambulanceId?: string;
  age?: number;
  gender?: string;
  phone?: string;
  chiefComplaint?: string;
  emergencyContact?: { name: string; phone: string; relation: string };
}

export interface AuditEvent {
  id: string;
  caseId: string;
  actor: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface EmergencyState {
  cases: EmergencyCase[];
  auditLogs: AuditEvent[];
}

const initialState: EmergencyState = {
  cases: [
    {
      id: 'SOS-101',
      patientName: 'Priya Desai',
      age: 34,
      gender: 'Female',
      phone: '+91 98201 44552',
      location: 'Linking Road, Bandra West, Mumbai',
      destinationHospital: 'Qlyno Multispecialty Hospital (Main Campus)',
      priority: 'Critical',
      status: 'Hospital Notified',
      deliveryState: 'Pending Ack',
      flowType: 'Flow A (Active Relationship)',
      chiefComplaint: 'Acute chest pain radiating to left arm with shortness of breath',
      createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
      slaBreached: false,
      assignedTeam: 'Emergency Response Unit 1',
      emergencyContact: { name: 'Vikram Desai', phone: '+91 98201 44550', relation: 'Spouse' },
    },
    {
      id: 'SOS-102',
      patientName: 'Aditya Kulkarni',
      age: 48,
      gender: 'Male',
      phone: '+91 97654 32190',
      location: 'Western Express Highway, Flyover Exit 4, Andheri',
      destinationHospital: 'Qlyno Multispecialty Hospital (Main Campus)',
      priority: 'Critical',
      status: 'Acknowledged',
      deliveryState: 'Delivered',
      flowType: 'Flow A (Active Relationship)',
      chiefComplaint: 'Severe road traffic accident, suspected polytrauma',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      slaBreached: false,
      assignedTeam: 'Trauma Team Alpha (Dr. Rajesh Sharma)',
      ambulanceId: 'AMB-01',
      emergencyContact: { name: 'Sneha Kulkarni', phone: '+91 97654 32191', relation: 'Wife' },
    },
    {
      id: 'SOS-103',
      patientName: 'Kavita Nair (Unregistered)',
      age: 29,
      gender: 'Female',
      phone: '+91 99887 76655',
      location: 'Hiranandani Business Park, Powai, Mumbai',
      destinationHospital: 'Qlyno Multispecialty Hospital (Main Campus)',
      priority: 'High',
      status: 'Hospital Notified',
      deliveryState: 'Escalated',
      flowType: 'Flow B (Location Routing)',
      chiefComplaint: 'Sudden onset loss of consciousness, unresponsive in office lobby',
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago (SLA breached)
      slaBreached: true,
      assignedTeam: 'Triage Desk 2 (Coordinator: Suresh Menon)',
      emergencyContact: { name: 'Colleague / Bystander', phone: '+91 99887 76600', relation: 'Workplace' },
    },
    {
      id: 'SOS-104',
      patientName: 'Rohan Verma',
      age: 52,
      gender: 'Male',
      phone: '+91 91234 56780',
      location: 'Goregaon East Hub Mall, Mumbai',
      destinationHospital: 'Qlyno Multispecialty Hospital (Main Campus)',
      priority: 'Medium',
      status: 'Pre-Arrival',
      deliveryState: 'Delivered',
      flowType: 'Flow A (Active Relationship)',
      chiefComplaint: 'Asthma exacerbation, oxygen saturation 88% on room air',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      slaBreached: false,
      assignedTeam: 'Pulmonology ER Support',
      ambulanceId: 'AMB-03',
      emergencyContact: { name: 'Meena Verma', phone: '+91 91234 56781', relation: 'Daughter' },
    }
  ],
  auditLogs: [
    {
      id: 'log-1',
      caseId: 'SOS-102',
      actor: 'System Automated Workflow',
      action: 'SOS Alert Created from Qlyno App',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      details: 'Flow A active patient relationship detected. Auto-routed to Qlyno Multispecialty Hospital.',
    },
    {
      id: 'log-2',
      caseId: 'SOS-102',
      actor: 'Performed by Hospital Admin • acting within Emergency workflow',
      action: 'Acknowledged Administrative Receipt',
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      details: 'SLA timer stopped (2 mins response). Case routed to Trauma Team Alpha.',
    },
    {
      id: 'log-3',
      caseId: 'SOS-103',
      actor: 'System Auto-Escalation Engine',
      action: 'SLA Breached - Auto Escalated to Admin Director',
      timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      details: 'High priority alert exceeded 15 minute acknowledgment window. Notification pushed to coordinator.',
    }
  ],
};

export const emergencySlice = createSlice({
  name: 'emergency',
  initialState,
  reducers: {
    hydrateEmergencyState: (state, action: PayloadAction<Partial<EmergencyState>>) => {
      if (action.payload.cases) state.cases = action.payload.cases;
      if (action.payload.auditLogs) state.auditLogs = action.payload.auditLogs;
    },

    acknowledgeCase: (state, action: PayloadAction<{ id: string; actor: string }>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload.id);
      if (caseItem) {
        caseItem.status = 'Acknowledged';
        caseItem.deliveryState = 'Delivered';
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: action.payload.actor,
          action: 'Acknowledged Administrative Receipt & Routed to Clinical Team',
          timestamp: new Date().toISOString(),
          details: 'Receipt acknowledged by Admin. Routed to attending clinical emergency staff.',
        });
      }
    },
    updateCaseStatus: (state, action: PayloadAction<{ id: string; status: EmergencyStatus; actor: string; details?: string }>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload.id);
      if (caseItem) {
        caseItem.status = action.payload.status;
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: action.payload.actor,
          action: `Status Updated to ${action.payload.status}`,
          timestamp: new Date().toISOString(),
          details: action.payload.details || `Case status transitioned to ${action.payload.status}`,
        });
      }
    },
    triggerFallback: (state, action: PayloadAction<{ id: string; fallbackHospital: string; actor: string; reason?: string }>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload.id);
      if (caseItem) {
        caseItem.fallbackTriggered = true;
        caseItem.originalHospital = caseItem.destinationHospital;
        caseItem.fallbackHospital = action.payload.fallbackHospital;
        caseItem.destinationHospital = action.payload.fallbackHospital;
        caseItem.deliveryState = 'Escalated';
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: action.payload.actor,
          action: `Fallback Routing Triggered to ${action.payload.fallbackHospital}`,
          timestamp: new Date().toISOString(),
          details: `Primary hospital ${caseItem.originalHospital} unable to accept. Reason: ${action.payload.reason || 'Capacity limit reached'}. Re-routed to partner facility.`,
        });
      }
    },
    markSlaBreached: (state, action: PayloadAction<string>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload);
      if (caseItem && !caseItem.slaBreached && (caseItem.status === 'Hospital Notified' || caseItem.status === 'SOS Created')) {
        caseItem.slaBreached = true;
        caseItem.deliveryState = 'Escalated';
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: 'System Auto-Escalation Engine',
          action: 'SLA Breach Registered - Escalation Ladder Triggered',
          timestamp: new Date().toISOString(),
          details: `Case unacknowledged past SLA limit. Escalating notification to emergency coordinator.`,
        });
      }
    },
    linkAmbulanceToCase: (state, action: PayloadAction<{ caseId: string; ambulanceId: string; actor: string }>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload.caseId);
      if (caseItem) {
        caseItem.ambulanceId = action.payload.ambulanceId;
        caseItem.status = 'Ambulance Dispatched';
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: action.payload.actor,
          action: `Ambulance ${action.payload.ambulanceId} Dispatched`,
          timestamp: new Date().toISOString(),
          details: `Fleet resource ${action.payload.ambulanceId} linked and dispatched to incident location.`,
        });
      }
    },
    escalateCase: (state, action: PayloadAction<{ id: string; targetRole: string; reason: string; actor: string }>) => {
      const caseItem = state.cases.find((c) => c.id === action.payload.id);
      if (caseItem) {
        caseItem.deliveryState = 'Escalated';
        state.auditLogs.unshift({
          id: `log-${Date.now()}`,
          caseId: caseItem.id,
          actor: action.payload.actor,
          action: `Manual Escalation to ${action.payload.targetRole}`,
          timestamp: new Date().toISOString(),
          details: `Escalated by Admin. Reason: ${action.payload.reason}`,
        });
      }
    },
    triggerAlertSimulation: (state, action: PayloadAction<EmergencyCase>) => {
      state.cases.unshift(action.payload);
      state.auditLogs.unshift({
        id: `log-${Date.now()}`,
        caseId: action.payload.id,
        actor: 'System Simulated Trigger',
        action: `SOS Emergency Alert Activated (${action.payload.flowType})`,
        timestamp: new Date().toISOString(),
        details: `Simulated high-priority alert for ${action.payload.patientName} at ${action.payload.location}.`,
      });
    },
  },
});

export const {
  hydrateEmergencyState,
  acknowledgeCase,
  updateCaseStatus,
  triggerFallback,
  markSlaBreached,
  linkAmbulanceToCase,
  escalateCase,
  triggerAlertSimulation,
} = emergencySlice.actions;

export default emergencySlice.reducer;
