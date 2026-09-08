import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AmbulanceStatus =
  | 'Available'
  | 'Dispatched'
  | 'En Route'
  | 'At Scene'
  | 'Transporting'
  | 'At Hospital'
  | 'Maintenance/Offline';

export type DispatchStatus =
  | 'Created'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Re-routed'
  | 'Cancelled';

export type AmbulanceType = 'ALS' | 'BLS' | 'Neonatal ICU' | 'Patient Transport';

export interface DriverDetails {
  name: string;
  phone: string;
  licenseNo: string;
  shift?: string;
}

export interface CrewMember {
  name: string;
  role: 'Paramedic' | 'EMT' | 'Emergency Nurse' | 'Triage Specialist';
  phone: string;
}

export interface TelemetryData {
  lat: number;
  lng: number;
  speedKmH: number;
  heading: string;
  isGpsOnline: boolean;
  lastPing: string;
}

export interface Ambulance {
  id: string;
  vehicleNo: string;
  type: AmbulanceType;
  equipment: string[];
  baseLocation: string;
  status: AmbulanceStatus;
  driver?: DriverDetails;
  crew?: CrewMember[];
  driverName?: string; // backwards compatibility
  telemetry: TelemetryData;
  lastDispatchAt?: string;
  currentCaseId?: string;
  maintenanceNotes?: string;
}

export interface ReRouteLog {
  fromHospital: string;
  toHospital: string;
  reason: string;
  timestamp: string;
  triggeredBy: string;
}

export interface DispatchRecord {
  id: string;
  ambulanceId: string;
  vehicleNo: string;
  caseId?: string;
  patientName?: string;
  isPatientLinked: boolean;
  originAddress: string;
  destinationHospital: string;
  priority: 'Critical - Code Red' | 'Urgent - Code Yellow' | 'Standard Transport';
  status: DispatchStatus;
  timestamp: string;
  timestamps: {
    created: string;
    dispatched?: string;
    atScene?: string;
    arrivedHospital?: string;
    completed?: string;
  };
  reRouteHistory?: ReRouteLog[];
  notes?: string;
}

interface AmbulanceState {
  fleet: Ambulance[];
  dispatchHistory: DispatchRecord[];
  isGlobalGpsActive: boolean;
}

const initialState: AmbulanceState = {
  isGlobalGpsActive: true,
  fleet: [
    {
      id: 'AMB-101',
      vehicleNo: 'MH-12-AB-1234',
      type: 'ALS',
      equipment: ['Defibrillator', 'Transport Ventilator', 'Oxygen Tank', 'Cardiac Monitor', 'Suction Unit'],
      baseLocation: 'Qlyno Main Campus',
      status: 'Available',
      driver: {
        name: 'Ramesh Patel',
        phone: '+91 98220 11921',
        licenseNo: 'DL-MH-2018-9921',
        shift: 'Day Shift (08:00 - 16:00)',
      },
      driverName: 'Ramesh Patel',
      crew: [
        { name: 'Sunita Sharma', role: 'Paramedic', phone: '+91 98220 55102' },
        { name: 'Amit Verma', role: 'EMT', phone: '+91 98220 77199' },
      ],
      telemetry: {
        lat: 19.0760,
        lng: 72.8777,
        speedKmH: 0,
        heading: 'N',
        isGpsOnline: true,
        lastPing: 'Just now',
      },
    },
    {
      id: 'AMB-102',
      vehicleNo: 'MH-12-CD-5678',
      type: 'BLS',
      equipment: ['Oxygen Tank', 'First Aid Kit', 'Spine Board', 'Suction Unit'],
      baseLocation: 'Qlyno City Center',
      status: 'Maintenance/Offline',
      driver: {
        name: 'Suresh Kumar',
        phone: '+91 98330 44101',
        licenseNo: 'DL-MH-2016-4411',
        shift: 'General',
      },
      driverName: 'Suresh Kumar',
      crew: [],
      telemetry: {
        lat: 19.0820,
        lng: 72.8810,
        speedKmH: 0,
        heading: 'Stationary',
        isGpsOnline: false,
        lastPing: '2 hours ago',
      },
      maintenanceNotes: 'Brake fluid service and quarterly equipment recalibration.',
    },
    {
      id: 'AMB-103',
      vehicleNo: 'MH-12-EF-9012',
      type: 'ALS',
      equipment: ['Defibrillator', 'Transport Ventilator', 'Oxygen Tank', 'Infusion Pump', 'ECG Monitor'],
      baseLocation: 'Qlyno Main Campus',
      status: 'En Route',
      currentCaseId: 'SOS-101',
      driver: {
        name: 'Vikas Deshmukh',
        phone: '+91 98110 88231',
        licenseNo: 'DL-MH-2019-3329',
        shift: 'Night Shift (16:00 - 00:00)',
      },
      driverName: 'Vikas Deshmukh',
      crew: [
        { name: 'Kavita Joshi', role: 'Emergency Nurse', phone: '+91 98110 33412' },
        { name: 'Rajesh Gokhale', role: 'Paramedic', phone: '+91 98110 99481' },
      ],
      telemetry: {
        lat: 19.0895,
        lng: 72.8656,
        speedKmH: 48,
        heading: 'NE',
        isGpsOnline: true,
        lastPing: '10s ago',
      },
      lastDispatchAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: 'AMB-104',
      vehicleNo: 'MH-12-GH-3456',
      type: 'Neonatal ICU',
      equipment: ['Neonatal Incubator', 'Transport Ventilator', 'Oxygen Tank', 'Syringe Pump', 'Suction Unit'],
      baseLocation: 'Qlyno Main Campus',
      status: 'Available',
      driver: {
        name: 'Mohan Lal',
        phone: '+91 98990 66211',
        licenseNo: 'DL-MH-2020-7712',
        shift: 'Day Shift (08:00 - 16:00)',
      },
      driverName: 'Mohan Lal',
      crew: [
        { name: 'Dr. Priya Mehta', role: 'Triage Specialist', phone: '+91 98990 22394' },
      ],
      telemetry: {
        lat: 19.0762,
        lng: 72.8775,
        speedKmH: 0,
        heading: 'S',
        isGpsOnline: true,
        lastPing: '1m ago',
      },
    },
  ],
  dispatchHistory: [
    {
      id: 'DSP-8821',
      ambulanceId: 'AMB-103',
      vehicleNo: 'MH-12-EF-9012',
      caseId: 'SOS-101',
      patientName: 'Aarav Shah',
      isPatientLinked: true,
      originAddress: 'Bandra West, Link Road Junction, Mumbai',
      destinationHospital: 'Qlyno Main Multispecialty Hospital',
      priority: 'Critical - Code Red',
      status: 'In Progress',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      timestamps: {
        created: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        dispatched: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        atScene: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      },
      notes: 'Cardiac arrest alert. CPR in progress on scene.',
    },
    {
      id: 'DSP-8819',
      ambulanceId: 'AMB-101',
      vehicleNo: 'MH-12-AB-1234',
      caseId: 'SOS-098',
      patientName: 'Pooja Iyer',
      isPatientLinked: true,
      originAddress: 'Andheri East, MIDC Phase II, Mumbai',
      destinationHospital: 'Qlyno Main Multispecialty Hospital',
      priority: 'Urgent - Code Yellow',
      status: 'Completed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      timestamps: {
        created: new Date(Date.now() - 1000 * 60 * 60 * 4.5).toISOString(),
        dispatched: new Date(Date.now() - 1000 * 60 * 60 * 4.4).toISOString(),
        atScene: new Date(Date.now() - 1000 * 60 * 60 * 4.2).toISOString(),
        arrivedHospital: new Date(Date.now() - 1000 * 60 * 60 * 4.0).toISOString(),
        completed: new Date(Date.now() - 1000 * 60 * 60 * 3.8).toISOString(),
      },
      notes: 'Severe asthma exacerbation. Stabilized with nebulization.',
    },
    {
      id: 'DSP-8812',
      ambulanceId: 'AMB-104',
      vehicleNo: 'MH-12-GH-3456',
      caseId: 'SOS-091',
      isPatientLinked: false,
      originAddress: 'Kurla West, LBS Road, Mumbai',
      destinationHospital: 'City General Emergency Trauma Center',
      priority: 'Critical - Code Red',
      status: 'Re-routed',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      timestamps: {
        created: new Date(Date.now() - 1000 * 60 * 60 * 24.5).toISOString(),
        dispatched: new Date(Date.now() - 1000 * 60 * 60 * 24.3).toISOString(),
        atScene: new Date(Date.now() - 1000 * 60 * 60 * 24.1).toISOString(),
        arrivedHospital: new Date(Date.now() - 1000 * 60 * 60 * 23.8).toISOString(),
        completed: new Date(Date.now() - 1000 * 60 * 60 * 23.5).toISOString(),
      },
      reRouteHistory: [
        {
          fromHospital: 'Qlyno Main Multispecialty Hospital',
          toHospital: 'City General Emergency Trauma Center',
          reason: 'Primary PICU at capacity. Diverted to City General.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24.1).toISOString(),
          triggeredBy: 'Performed by Hospital Admin • acting within Ambulance Dispatch workflow',
        },
      ],
      notes: 'Neonatal distress transfer from maternity clinic.',
    },
  ],
};

export const ambulanceSlice = createSlice({
  name: 'ambulance',
  initialState,
  reducers: {
    hydrateAmbulanceState: (
      state,
      action: PayloadAction<{
        fleet: Ambulance[];
        dispatchHistory: DispatchRecord[];
      }>
    ) => {
      state.fleet = action.payload.fleet;
      state.dispatchHistory = action.payload.dispatchHistory;
    },

    upsertAmbulance: (state, action: PayloadAction<Ambulance>) => {
      const idx = state.fleet.findIndex((a) => a.id === action.payload.id);
      if (idx >= 0) {
        state.fleet[idx] = action.payload;
      } else {
        state.fleet.unshift(action.payload);
      }
    },

    upsertDispatchRecord: (state, action: PayloadAction<DispatchRecord>) => {
      const idx = state.dispatchHistory.findIndex((d) => d.id === action.payload.id);
      if (idx >= 0) {
        state.dispatchHistory[idx] = action.payload;
      } else {
        state.dispatchHistory.unshift(action.payload);
      }
    },

    registerAmbulance: (
      state,
      action: PayloadAction<{
        vehicleNo: string;
        type: AmbulanceType;
        equipment: string[];
        baseLocation: string;
        maintenanceNotes?: string;
      }>
    ) => {
      const id = `AMB-${100 + state.fleet.length + 1}`;
      state.fleet.push({
        id,
        vehicleNo: action.payload.vehicleNo,
        type: action.payload.type,
        equipment: action.payload.equipment,
        baseLocation: action.payload.baseLocation,
        status: 'Available',
        telemetry: {
          lat: 19.0760,
          lng: 72.8777,
          speedKmH: 0,
          heading: 'Stationary',
          isGpsOnline: true,
          lastPing: 'Just now',
        },
        maintenanceNotes: action.payload.maintenanceNotes,
      });
    },

    updateAmbulanceRegistry: (
      state,
      action: PayloadAction<{
        id: string;
        vehicleNo: string;
        type: AmbulanceType;
        equipment: string[];
        baseLocation: string;
        maintenanceNotes?: string;
      }>
    ) => {
      const amb = state.fleet.find((a) => a.id === action.payload.id);
      if (amb) {
        amb.vehicleNo = action.payload.vehicleNo;
        amb.type = action.payload.type;
        amb.equipment = action.payload.equipment;
        amb.baseLocation = action.payload.baseLocation;
        if (action.payload.maintenanceNotes !== undefined) {
          amb.maintenanceNotes = action.payload.maintenanceNotes;
        }
      }
    },

    assignDriverCrew: (
      state,
      action: PayloadAction<{
        ambulanceId: string;
        driver: DriverDetails;
        crew: CrewMember[];
      }>
    ) => {
      const amb = state.fleet.find((a) => a.id === action.payload.ambulanceId);
      if (amb) {
        amb.driver = action.payload.driver;
        amb.driverName = action.payload.driver.name;
        amb.crew = action.payload.crew;
      }
    },

    updateAmbulanceStatus: (
      state,
      action: PayloadAction<{ id: string; status: AmbulanceStatus; notes?: string }>
    ) => {
      const amb = state.fleet.find((a) => a.id === action.payload.id);
      if (amb) {
        amb.status = action.payload.status;

        // If moved to maintenance or available, clear active case if resolved
        if (action.payload.status === 'Available') {
          amb.currentCaseId = undefined;
          amb.telemetry.speedKmH = 0;
          amb.telemetry.heading = 'Stationary';
        } else if (action.payload.status === 'En Route' || action.payload.status === 'Transporting') {
          amb.telemetry.speedKmH = 45;
        } else if (action.payload.status === 'At Scene' || action.payload.status === 'At Hospital') {
          amb.telemetry.speedKmH = 0;
        }

        // Update corresponding dispatch record timestamps
        const activeDispatch = state.dispatchHistory.find(
          (d) => d.ambulanceId === amb.id && (d.status === 'In Progress' || d.status === 'Re-routed' || d.status === 'Assigned')
        );

        if (activeDispatch) {
          const now = new Date().toISOString();
          if (action.payload.status === 'At Scene') {
            activeDispatch.timestamps.atScene = now;
          } else if (action.payload.status === 'At Hospital') {
            activeDispatch.timestamps.arrivedHospital = now;
          } else if (action.payload.status === 'Available') {
            activeDispatch.status = 'Completed';
            activeDispatch.timestamps.completed = now;
          }
        }
      }
    },

    dispatchAmbulance: (
      state,
      action: PayloadAction<{
        ambulanceId: string;
        caseId?: string;
        patientName?: string;
        isPatientLinked: boolean;
        originAddress: string;
        destinationHospital: string;
        priority?: 'Critical - Code Red' | 'Urgent - Code Yellow' | 'Standard Transport';
        notes?: string;
      }>
    ) => {
      const amb = state.fleet.find((a) => a.id === action.payload.ambulanceId);
      if (amb) {
        amb.status = 'Dispatched';
        amb.currentCaseId = action.payload.caseId;
        amb.lastDispatchAt = new Date().toISOString();
        amb.telemetry.speedKmH = 30;
        amb.telemetry.heading = 'Outbound';

        const dispatchId = `DSP-${Math.floor(1000 + Math.random() * 9000)}`;
        const now = new Date().toISOString();

        state.dispatchHistory.unshift({
          id: dispatchId,
          ambulanceId: amb.id,
          vehicleNo: amb.vehicleNo,
          caseId: action.payload.caseId,
          patientName: action.payload.isPatientLinked ? action.payload.patientName : undefined,
          isPatientLinked: action.payload.isPatientLinked,
          originAddress: action.payload.originAddress || amb.baseLocation,
          destinationHospital: action.payload.destinationHospital,
          priority: action.payload.priority || 'Urgent - Code Yellow',
          status: 'In Progress',
          timestamp: now,
          timestamps: {
            created: now,
            dispatched: now,
          },
          notes: action.payload.notes,
        });
      }
    },

    freeAmbulance: (state, action: PayloadAction<string>) => {
      const amb = state.fleet.find((a) => a.id === action.payload);
      if (amb) {
        amb.status = 'Available';
        amb.currentCaseId = undefined;
        amb.telemetry.speedKmH = 0;
        amb.telemetry.heading = 'Stationary';

        const activeDispatch = state.dispatchHistory.find(
          (d) => d.ambulanceId === action.payload && (d.status === 'In Progress' || d.status === 'Re-routed' || d.status === 'Assigned')
        );
        if (activeDispatch) {
          activeDispatch.status = 'Completed';
          activeDispatch.timestamps.completed = new Date().toISOString();
        }
      }
    },

    updateDispatchDestination: (
      state,
      action: PayloadAction<{
        ambulanceId: string;
        newDestination: string;
        reason?: string;
      }>
    ) => {
      const activeDispatch = state.dispatchHistory.find(
        (d) => d.ambulanceId === action.payload.ambulanceId && (d.status === 'In Progress' || d.status === 'Re-routed')
      );
      if (activeDispatch) {
        const prev = activeDispatch.destinationHospital;
        activeDispatch.destinationHospital = action.payload.newDestination;
        activeDispatch.status = 'Re-routed';

        if (!activeDispatch.reRouteHistory) {
          activeDispatch.reRouteHistory = [];
        }

        activeDispatch.reRouteHistory.push({
          fromHospital: prev,
          toHospital: action.payload.newDestination,
          reason: action.payload.reason || 'Receiving hospital diversion / capacity fallback',
          timestamp: new Date().toISOString(),
          triggeredBy: 'Performed by Hospital Admin • acting within Ambulance Dispatch workflow',
        });
      }
    },

    reassignAmbulance: (
      state,
      action: PayloadAction<{
        failedAmbulanceId: string;
        newAmbulanceId: string;
        reason: string;
      }>
    ) => {
      const failedAmb = state.fleet.find((a) => a.id === action.payload.failedAmbulanceId);
      const newAmb = state.fleet.find((a) => a.id === action.payload.newAmbulanceId);

      if (failedAmb && newAmb) {
        const caseId = failedAmb.currentCaseId;

        // Set failed vehicle to maintenance/offline
        failedAmb.status = 'Maintenance/Offline';
        failedAmb.currentCaseId = undefined;
        failedAmb.maintenanceNotes = `Vehicle breakdown during dispatch: ${action.payload.reason}`;

        // Assign new vehicle
        newAmb.status = 'Dispatched';
        newAmb.currentCaseId = caseId;
        newAmb.lastDispatchAt = new Date().toISOString();

        // Update dispatch log
        const activeDispatch = state.dispatchHistory.find(
          (d) => d.ambulanceId === failedAmb.id && (d.status === 'In Progress' || d.status === 'Re-routed')
        );

        if (activeDispatch) {
          activeDispatch.ambulanceId = newAmb.id;
          activeDispatch.vehicleNo = newAmb.vehicleNo;
          activeDispatch.notes = `Vehicle swapped from ${failedAmb.vehicleNo} to ${newAmb.vehicleNo}. Reason: ${action.payload.reason}`;
        }
      }
    },

    cancelDispatch: (
      state,
      action: PayloadAction<{ ambulanceId: string; reason?: string }>
    ) => {
      const amb = state.fleet.find((a) => a.id === action.payload.ambulanceId);
      if (amb) {
        amb.status = 'Available';
        amb.currentCaseId = undefined;
        amb.telemetry.speedKmH = 0;
      }

      const activeDispatch = state.dispatchHistory.find(
        (d) => d.ambulanceId === action.payload.ambulanceId && (d.status === 'In Progress' || d.status === 'Re-routed')
      );
      if (activeDispatch) {
        activeDispatch.status = 'Cancelled';
        activeDispatch.timestamps.completed = new Date().toISOString();
        if (action.payload.reason) {
          activeDispatch.notes = `Dispatch cancelled: ${action.payload.reason}`;
        }
      }
    },

    toggleGlobalGps: (state, action: PayloadAction<boolean | undefined>) => {
      state.isGlobalGpsActive = action.payload !== undefined ? action.payload : !state.isGlobalGpsActive;
      state.fleet.forEach((a) => {
        a.telemetry.isGpsOnline = state.isGlobalGpsActive;
      });
    },
  },
});

export const {
  hydrateAmbulanceState,
  upsertAmbulance,
  upsertDispatchRecord,
  registerAmbulance,
  updateAmbulanceRegistry,
  assignDriverCrew,
  updateAmbulanceStatus,
  dispatchAmbulance,
  freeAmbulance,
  updateDispatchDestination,
  reassignAmbulance,
  cancelDispatch,
  toggleGlobalGps,
} = ambulanceSlice.actions;

export default ambulanceSlice.reducer;
