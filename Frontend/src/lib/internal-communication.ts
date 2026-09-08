import type { ReceptionistDoctor } from "@/components/receptionist/mock-data";
import { staff as clinicStaff } from "@/lib/mock-data";
import { Workplace } from "@/lib/doctor-workflow-types";

export type InternalContactScope = "clinic" | "hospital";

export interface InternalContact {
  id: string;
  name: string;
  role: string;
  team: string;
  scope: InternalContactScope;
  workplaceId?: string;
  status: "Online" | "Busy" | "Offline";
  lastMessage: string;
  time: string;
  unread?: number;
}

export interface InternalChatMessage {
  id?: string;
  from: "me" | "them";
  text: string;
  time: string;
}

const hospitalContacts: InternalContact[] = [
  {
    id: "hospital-duty-manager",
    name: "Neha Sinha",
    role: "Duty Manager",
    team: "Hospital Operations",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Online",
    lastMessage: "Ward requests are routed through the duty desk.",
    time: "8 min ago",
    unread: 1,
  },
  {
    id: "hospital-charge-nurse",
    name: "Suresh Iyer",
    role: "Charge Nurse",
    team: "Nursing Station",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Online",
    lastMessage: "Vitals and medication updates are ready for review.",
    time: "18 min ago",
    unread: 2,
  },
  {
    id: "hospital-lab",
    name: "Apollo Diagnostics Desk",
    role: "Lab Coordinator",
    team: "Laboratory",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Busy",
    lastMessage: "Critical reports will be escalated here.",
    time: "42 min ago",
  },
  {
    id: "hospital-radiology",
    name: "Radiology Control Room",
    role: "Radiology Coordinator",
    team: "Imaging",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Online",
    lastMessage: "Portable X-ray slots are being coordinated.",
    time: "1 hr ago",
  },
  {
    id: "hospital-pharmacy",
    name: "Inpatient Pharmacy",
    role: "Pharmacist",
    team: "Pharmacy",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Online",
    lastMessage: "Medication stock checks can be sent here.",
    time: "Yesterday",
  },
  {
    id: "hospital-billing",
    name: "Billing Coordination Desk",
    role: "Billing Staff",
    team: "Billing",
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: "Busy",
    lastMessage: "Insurance and discharge billing questions are open.",
    time: "Yesterday",
  },
];

function doctorContacts(doctors: ReceptionistDoctor[] = []): InternalContact[] {
  return doctors.map<InternalContact>((doctor, index) => ({
    id: `hospital-doctor-${index + 1}`,
    name: doctor.name,
    role: "Doctor",
    team: doctor.department,
    scope: "hospital",
    workplaceId: "wp-hospital-aster",
    status: index % 3 === 1 ? "Busy" : "Online",
    lastMessage: `Available for ${doctor.department} coordination.`,
    time: index < 2 ? "Today" : "Yesterday",
  }));
}

const seededClinicContacts: InternalContact[] = clinicStaff.map((member) => ({
  id: `clinic-${member.id}`,
  name: member.name,
  role: member.role,
  team: member.role === "Lab/Pharmacy User" ? "Lab / Pharmacy" : "Clinic Staff",
  scope: "clinic",
  workplaceId: member.locationId === "loc-2" ? "wp-clinic-indiranagar" : "wp-clinic-mg",
  status: member.status === "Active" ? "Online" : "Offline",
  lastMessage:
    member.role === "Receptionist"
      ? "Front desk queue updates will appear here."
      : member.role === "Nurse"
        ? "Vitals, room readiness and patient movement updates."
        : "Operational updates for today's clinic flow.",
  time: member.status === "Active" ? "Today" : "Invited",
}));

export function getInternalContactsForScope(scope: InternalContactScope, workplace?: Workplace) {
  const contacts = scope === "hospital" ? hospitalContacts : seededClinicContacts;
  const scoped = workplace?.id ? contacts.filter((contact) => !contact.workplaceId || contact.workplaceId === workplace.id) : contacts;
  return scoped.length > 0 ? scoped : contacts;
}

export function getAllHospitalInternalContacts(doctors: ReceptionistDoctor[] = []) {
  return [...hospitalContacts, ...doctorContacts(doctors)];
}

export function initialInternalThreads(contacts: InternalContact[]) {
  return contacts.reduce<Record<string, InternalChatMessage[]>>((acc, contact) => {
    acc[contact.id] = [
      {
        from: "them",
        text: contact.lastMessage,
        time: contact.time,
      },
    ];
    return acc;
  }, {});
}
