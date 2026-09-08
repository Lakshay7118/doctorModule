"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  clinicQueue as clinicQueueSeed,
  doctorShifts as doctorShiftsSeed,
  doctorTasks as doctorTasksSeed,
  doctorWorkplaces,
  hospitalWorklist as hospitalWorklistSeed,
} from "./doctor-workflow-data";
import {
  ClinicQueueItem,
  DoctorShift,
  DoctorTaskItem,
  HospitalWorkItem,
  ShiftStatus,
  Workplace,
  workplaceToContext,
} from "./doctor-workflow-types";
import { useMode } from "./mode-context";
import { getBackendBootstrap, getBackendState, saveBackendState } from "./api-client";

interface DoctorWorkflowContextValue {
  isLoadingWorkflow: boolean;
  workplaces: Workplace[];
  shifts: DoctorShift[];
  clinicQueue: ClinicQueueItem[];
  hospitalWorklist: HospitalWorkItem[];
  doctorTasks: DoctorTaskItem[];
  backendDoctorId?: string;
  activeShift?: DoctorShift;
  selectedShift?: DoctorShift;
  selectShift: (id?: string) => void;
  getWorkplace: (id: string) => Workplace | undefined;
  startShift: (id: string) => void;
  completeShift: (id: string) => void;
  addShift: (shift: DoctorShift) => void;
  updateShiftStatus: (id: string, status: ShiftStatus) => void;
  startQueueConsultation: (id: string) => void;
  completeQueueConsultation: (id: string) => void;
  acceptHospitalRequest: (id: string) => void;
  completeHospitalItem: (id: string) => void;
  handoverHospitalItem: (id: string, doctorName: string) => void;
  completeTask: (id: string) => void;
  startTask: (id: string) => void;
}

const DoctorWorkflowContext = createContext<DoctorWorkflowContextValue | null>(null);

interface WorkflowStateSnapshot {
  clinicQueue: ClinicQueueItem[];
  hospitalWorklist: HospitalWorkItem[];
  doctorTasks: DoctorTaskItem[];
}

const WORKFLOW_STATE_SCOPE = "doctor-workflow";
const WORKFLOW_STATE_ENTITY_ID = "doctor-workspace";

export function DoctorWorkflowProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setSelectedWorkplaceId, setWorkContext } = useMode();
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [clinicQueue, setClinicQueue] = useState<ClinicQueueItem[]>([]);
  const [hospitalWorklist, setHospitalWorklist] = useState<HospitalWorkItem[]>([]);
  const [doctorTasks, setDoctorTasks] = useState<DoctorTaskItem[]>([]);
  const [backendDoctorId, setBackendDoctorId] = useState<string | undefined>();
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>();
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(true);

  const activeShift = shifts.find((shift) => shift.status === "active");
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId);

  useEffect(() => {
    if (!pathname.startsWith("/doctor")) {
      setBackendDoctorId(undefined);
      setWorkplaces(doctorWorkplaces);
      setShifts(doctorShiftsSeed);
      setClinicQueue(clinicQueueSeed);
      setHospitalWorklist(hospitalWorklistSeed);
      setDoctorTasks(doctorTasksSeed);
      setIsLoadingWorkflow(false);
      return;
    }

    let cancelled = false;
    let pendingLoads = 2;
    const finishLoad = () => {
      pendingLoads -= 1;
      if (!cancelled && pendingLoads === 0) setIsLoadingWorkflow(false);
    };

    getBackendBootstrap()
      .then((data) => {
        if (cancelled) return;
        if (data.doctors[0]?.id) setBackendDoctorId(data.doctors[0].id);
        if (data.workplaces.length > 0) setWorkplaces(data.workplaces);
        if (data.workplaceId) setSelectedWorkplaceId(data.workplaceId);
        setShifts(data.shifts);
      })
      .catch(() => {
        if (!cancelled) {
          setBackendDoctorId(undefined);
          setWorkplaces(doctorWorkplaces);
          setShifts(doctorShiftsSeed);
        }
      })
      .finally(finishLoad);

    getBackendState<Partial<WorkflowStateSnapshot>>(WORKFLOW_STATE_SCOPE, WORKFLOW_STATE_ENTITY_ID)
      .then((state) => {
        if (cancelled) return;
        setClinicQueue(Array.isArray(state?.clinicQueue) ? state.clinicQueue : clinicQueueSeed);
        setHospitalWorklist(Array.isArray(state?.hospitalWorklist) ? state.hospitalWorklist : hospitalWorklistSeed);
        setDoctorTasks(Array.isArray(state?.doctorTasks) ? state.doctorTasks : doctorTasksSeed);
      })
      .catch(() => {
        if (cancelled) return;
        setClinicQueue(clinicQueueSeed);
        setHospitalWorklist(hospitalWorklistSeed);
        setDoctorTasks(doctorTasksSeed);
      })
      .finally(finishLoad);

    return () => {
      cancelled = true;
    };
  }, [pathname, setSelectedWorkplaceId]);

  function persistWorkflowState(snapshot: WorkflowStateSnapshot) {
    void saveBackendState(WORKFLOW_STATE_SCOPE, WORKFLOW_STATE_ENTITY_ID, snapshot).catch(() => undefined);
  }

  function getWorkplace(id: string) {
    return workplaces.find((workplace) => workplace.id === id);
  }

  function startShift(id: string) {
    setShifts((prev) =>
      prev.map((shift) => ({
        ...shift,
        status: shift.id === id ? "active" : shift.status === "active" ? "upcoming" : shift.status,
      }))
    );
    const shift = shifts.find((item) => item.id === id);
    const workplace = shift ? getWorkplace(shift.workplaceId) : undefined;
    if (workplace) {
      setWorkContext(workplaceToContext(workplace.type));
      setSelectedWorkplaceId(workplace.id);
    }
  }

  function completeShift(id: string) {
    setShifts((prev) => prev.map((shift) => (shift.id === id ? { ...shift, status: "completed" } : shift)));
  }

  function updateShiftStatus(id: string, status: ShiftStatus) {
    setShifts((prev) => prev.map((shift) => (shift.id === id ? { ...shift, status } : shift)));
  }

  function addShift(shift: DoctorShift) {
    setShifts((prev) => [shift, ...prev]);
  }

  function startQueueConsultation(id: string) {
    setClinicQueue((prev) => {
      const next: ClinicQueueItem[] = prev.map((item) => ({
        ...item,
        status: item.id === id ? "in_consultation" : item.status,
      }));
      persistWorkflowState({ clinicQueue: next, hospitalWorklist, doctorTasks });
      return next;
    });
  }

  function completeQueueConsultation(id: string) {
    setClinicQueue((prev) => {
      const next: ClinicQueueItem[] = prev.map((item) => (item.id === id ? { ...item, status: "completed" } : item));
      persistWorkflowState({ clinicQueue: next, hospitalWorklist, doctorTasks });
      return next;
    });
  }

  function acceptHospitalRequest(id: string) {
    setHospitalWorklist((prev) => {
      const next: HospitalWorkItem[] = prev.map((item) =>
        item.id === id ? { ...item, status: "assigned", reasonAssigned: "Accepted consult request" } : item
      );
      persistWorkflowState({ clinicQueue, hospitalWorklist: next, doctorTasks });
      return next;
    });
  }

  function completeHospitalItem(id: string) {
    setHospitalWorklist((prev) => {
      const next: HospitalWorkItem[] = prev.map((item) => (item.id === id ? { ...item, status: "completed" } : item));
      persistWorkflowState({ clinicQueue, hospitalWorklist: next, doctorTasks });
      return next;
    });
  }

  function handoverHospitalItem(id: string, doctorName: string) {
    setHospitalWorklist((prev) => {
      const next: HospitalWorkItem[] = prev.map((item) =>
        item.id === id
          ? { ...item, handedOverTo: doctorName, reasonAssigned: `Handed over to ${doctorName}` }
          : item
      );
      persistWorkflowState({ clinicQueue, hospitalWorklist: next, doctorTasks });
      return next;
    });
  }

  function completeTask(id: string) {
    setDoctorTasks((prev) => {
      const next: DoctorTaskItem[] = prev.map((task) => (task.id === id ? { ...task, status: "completed" } : task));
      persistWorkflowState({ clinicQueue, hospitalWorklist, doctorTasks: next });
      return next;
    });
  }

  function startTask(id: string) {
    setDoctorTasks((prev) => {
      const next: DoctorTaskItem[] = prev.map((task) => (task.id === id ? { ...task, status: "today" } : task));
      persistWorkflowState({ clinicQueue, hospitalWorklist, doctorTasks: next });
      return next;
    });
  }

  const value = {
    isLoadingWorkflow,
    workplaces,
    shifts,
    clinicQueue,
    hospitalWorklist,
    doctorTasks,
    backendDoctorId,
    activeShift,
    selectedShift,
    selectShift: setSelectedShiftId,
    getWorkplace,
    startShift,
    completeShift,
    addShift,
    updateShiftStatus,
    startQueueConsultation,
    completeQueueConsultation,
    acceptHospitalRequest,
    completeHospitalItem,
    handoverHospitalItem,
    completeTask,
    startTask,
  };

  return <DoctorWorkflowContext.Provider value={value}>{children}</DoctorWorkflowContext.Provider>;
}

export function useDoctorWorkflow() {
  const ctx = useContext(DoctorWorkflowContext);
  if (!ctx) throw new Error("useDoctorWorkflow must be used within DoctorWorkflowProvider");
  return ctx;
}
 
