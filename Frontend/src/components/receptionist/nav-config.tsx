import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  TicketCheck,
  Stethoscope,
  BedDouble,
  BadgeCheck,
  Receipt,
  Siren,
  MessageSquareText,
  FileBarChart2,
  Settings2,
  Zap,
} from "lucide-react";
import type { ReceptionistContextType } from "@/lib/api-client";

export type ModuleId =
  | "dashboard"
  | "patient-registration"
  | "patient-directory"
  | "appointments"
  | "check-in"
  | "opd"
  | "ipd-admission"
  | "visitors"
  | "billing"
  | "emergency"
  | "communication"
  | "follow-ups"
  | "tasks"
  | "documents"
  | "coordination"
  | "ai-assistant"
  | "reports"
  | "settings"
  | "search"
  | "quick-actions";

export interface NavItem {
  id: ModuleId;
  number: string;
  label: string;
  icon: LucideIcon;
  href: string;
  contexts: ReceptionistContextType[];
}

const allContexts: ReceptionistContextType[] = ["solo-doctor", "clinic", "hospital"];
const clinicHospital: ReceptionistContextType[] = ["clinic", "hospital"];
const hospitalOnly: ReceptionistContextType[] = ["hospital"];

export const navItems: NavItem[] = [
  { id: "dashboard", number: "01", label: "Dashboard", icon: LayoutDashboard, href: "/receptionist/dashboard", contexts: allContexts },
  { id: "patient-directory", number: "02", label: "Patients", icon: Users, href: "/receptionist/patient-directory", contexts: allContexts },
  { id: "appointments", number: "03", label: "Appointment Management", icon: CalendarCheck, href: "/receptionist/appointments", contexts: allContexts },
  { id: "check-in", number: "04", label: "Patient Check-in", icon: TicketCheck, href: "/receptionist/check-in", contexts: allContexts },
  { id: "opd", number: "05", label: "OPD Management", icon: Stethoscope, href: "/receptionist/opd", contexts: clinicHospital },
  { id: "ipd-admission", number: "06", label: "IPD Admission", icon: BedDouble, href: "/receptionist/ipd-admission", contexts: hospitalOnly },
  { id: "visitors", number: "07", label: "Visitor Management", icon: BadgeCheck, href: "/receptionist/visitors", contexts: hospitalOnly },
  { id: "billing", number: "08", label: "Billing Coordination", icon: Receipt, href: "/receptionist/billing", contexts: allContexts },
  { id: "emergency", number: "09", label: "Emergency Reception", icon: Siren, href: "/receptionist/emergency", contexts: hospitalOnly },
  { id: "communication", number: "10", label: "Communication & Notifications", icon: MessageSquareText, href: "/receptionist/communication", contexts: allContexts },
  { id: "reports", number: "11", label: "Reports", icon: FileBarChart2, href: "/receptionist/reports", contexts: allContexts },
  { id: "settings", number: "12", label: "Settings", icon: Settings2, href: "/receptionist/settings", contexts: allContexts },
  { id: "quick-actions", number: "13", label: "Quick Actions", icon: Zap, href: "/receptionist/quick-actions", contexts: allContexts },
];

export function navItemsForContext(type: ReceptionistContextType) {
  return navItems.filter((item) => item.contexts.includes(type));
}
