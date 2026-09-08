"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppUserRole } from "@/hospital-admin/lib/types/nursing-module";
import { NURSING_STORAGE_KEY } from "@/hospital-admin/store/provider";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Bed,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileBarChart,
  FileText,
  HeartPulse,
  LogOut,
  Menu,
  Pill,
  Plus,
  Radio,
  Search,
  ShieldAlert,
  ShoppingBag,
  Siren,
  Sparkles,
  Stethoscope,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/hospital-admin/components/ui/badge";
import { Button } from "@/hospital-admin/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/hospital-admin/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/hospital-admin/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/hospital-admin/components/ui/tooltip";
import { useSelector } from "react-redux";
import { RootState } from "@/hospital-admin/store/store";
import { getWorkspaceMetaForRole } from "@/hospital-admin/components/layout/nav-items";
import { SidebarNav } from "@/hospital-admin/components/layout/sidebar";
import { getNotificationsForRole } from "@/hospital-admin/lib/mock-data/notifications-extended";
import { GlobalSearch } from "@/hospital-admin/components/layout/global-search";
import { signOutToRoot } from "@/lib/client-session";

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const reduxRole = useSelector((state: RootState) => state.nursingOperations.currentRole);
  const [persistedRole, setPersistedRole] = useState<AppUserRole | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(NURSING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.currentRole === "string" &&
            ["admin", "nurse_lead", "senior_nurse", "nurse", "support_staff", "doctor"].includes(parsed.currentRole)
          ) {
            return parsed.currentRole as AppUserRole;
          }
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(NURSING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.currentRole === "string" &&
            ["admin", "nurse_lead", "senior_nurse", "nurse", "support_staff", "doctor"].includes(parsed.currentRole)
          ) {
            setPersistedRole(parsed.currentRole as AppUserRole);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const routeInferredRole: AppUserRole | null =
    pathname?.startsWith("/hospital-admin/nurse-station")
      ? (reduxRole === "senior_nurse" ? "senior_nurse" : "nurse_lead")
      : pathname === "/hospital-admin/nurse"
      ? "nurse"
      : pathname === "/hospital-admin/support-staff"
      ? "support_staff"
      : null;

  const effectiveRole: AppUserRole =
    persistedRole ||
    (routeInferredRole && reduxRole === "admin" ? routeInferredRole : reduxRole) ||
    "admin";

  const meta = getWorkspaceMetaForRole(effectiveRole);
  const roleNotifications = getNotificationsForRole(effectiveRole);
  const unread = roleNotifications.filter((n) => n.status === "Unread").length;

  const dispatchStationAction = (action: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nurse-station-action", { detail: action }));
    }
  };

  const dispatchNurseAction = (action: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nurse-action", { detail: action }));
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6 print:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="hidden flex-1 sm:flex items-center gap-3">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Role Scope Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-xs">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-semibold text-foreground">{meta.profileRole}</span>
          </div>

          {/* 1. Notifications Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground">
                    {unread}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between py-2">
                <span>Notifications</span>
                {unread > 0 && (
                  <span className="text-[11px] font-normal text-muted-foreground">{unread} unread alerts</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                {roleNotifications.slice(0, 4).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-2 cursor-pointer" asChild>
                    <Link href={n.linkUrl}>
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold">{n.title}</span>
                        <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="justify-center text-center text-xs font-semibold text-primary">
                <Link
                  href={
                    effectiveRole === "admin"
                      ? "/hospital-admin/notifications"
                      : effectiveRole === "support_staff"
                      ? "/hospital-admin/support-staff"
                      : effectiveRole === "nurse"
                      ? "/hospital-admin/nurse"
                      : "/hospital-admin/nurse-station"
                  }
                >
                  View All Notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 2. Emergency Direct Action Button - Hospital Admin Only */}
          {effectiveRole === "admin" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-semibold text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/50"
                  asChild
                >
                  <Link href="/hospital-admin/emergency">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    <span>Emergency</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emergency / SOS Command</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 3. Role-Based Quick Action Button & Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 h-9 font-medium shadow-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Quick Action</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-68">
              {/* NURSE STATION LEAD QUICK ACTIONS (All 9 Source-Defined Actions) */}
              {effectiveRole === "nurse_lead" && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Nurse Station Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("add-nurse")}>
                      <Link href="/hospital-admin/nurse-station?action=add-nurse" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <UserPlus className="h-4 w-4 text-blue-600" />
                        <span>Add Nurse</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("add-support-staff")}>
                      <Link href="/hospital-admin/nurse-station?action=add-support-staff" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <span>Add Support Staff</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("create-shift")}>
                      <Link href="/hospital-admin/nurse-station?action=create-shift" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <span>Create Shift</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("roster")}>
                      <Link href="/hospital-admin/roster" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <CalendarDays className="h-4 w-4 text-teal-600" />
                        <span>Create Roster</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("assign-patient")}>
                      <Link href="/hospital-admin/nurse-station?action=assign-patient" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Users className="h-4 w-4 text-cyan-600" />
                        <span>Assign Patient</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("assign-task")}>
                      <Link href="/hospital-admin/nurse-station?action=assign-task" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Assign Task</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("start-handover")}>
                      <Link href="/hospital-admin/nurse-station?action=start-handover" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <ArrowRight className="h-4 w-4 text-amber-600" />
                        <span>Start Handover</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("broadcast")}>
                      <Link href="/hospital-admin/nurse-station?action=broadcast" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Radio className="h-4 w-4 text-violet-600" />
                        <span>Broadcast Message</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("exceptions")}>
                      <Link href="/hospital-admin/nurse-station?action=exceptions" className="flex items-center gap-2.5 cursor-pointer text-xs text-destructive font-semibold">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>View Exceptions</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              {/* SENIOR NURSE QUICK ACTIONS */}
              {effectiveRole === "senior_nurse" && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Care Coordination Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("roster")}>
                      <Link href="/hospital-admin/roster" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <CalendarDays className="h-4 w-4 text-teal-600" />
                        <span>Create Roster</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("assign-patient")}>
                      <Link href="/hospital-admin/nurse-station?action=assign-patient" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Users className="h-4 w-4 text-cyan-600" />
                        <span>Assign Patient</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("assign-task")}>
                      <Link href="/hospital-admin/nurse-station?action=assign-task" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Assign Task</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("start-handover")}>
                      <Link href="/hospital-admin/nurse-station?action=start-handover" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <ArrowRight className="h-4 w-4 text-amber-600" />
                        <span>Start Handover</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("broadcast")}>
                      <Link href="/hospital-admin/nurse-station?action=broadcast" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Radio className="h-4 w-4 text-violet-600" />
                        <span>Broadcast Message</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchStationAction("exceptions")}>
                      <Link href="/hospital-admin/nurse-station?action=exceptions" className="flex items-center gap-2.5 cursor-pointer text-xs text-destructive font-semibold">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>View Exceptions</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              {/* STAFF NURSE QUICK ACTIONS */}
              {effectiveRole === "nurse" && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Bedside Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild onClick={() => dispatchNurseAction("vitals")}>
                      <Link href="/hospital-admin/nurse?action=vitals" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Activity className="h-4 w-4 text-rose-600" />
                        <span>Record Vitals</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchNurseAction("emar")}>
                      <Link href="/hospital-admin/nurse?action=emar" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Pill className="h-4 w-4 text-emerald-600" />
                        <span>Administer Med (eMAR)</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchNurseAction("note")}>
                      <Link href="/hospital-admin/nurse?action=note" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span>Add Nursing Care Note</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchNurseAction("handover")}>
                      <Link href="/hospital-admin/nurse?action=handover" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <ArrowRight className="h-4 w-4 text-amber-600" />
                        <span>Start Shift Handover</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onClick={() => dispatchNurseAction("escalate")}>
                      <Link href="/hospital-admin/nurse?action=escalate" className="flex items-center gap-2.5 cursor-pointer text-xs text-destructive font-semibold">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        <span>Escalate Clinical Concern</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              {/* SUPPORT STAFF QUICK ACTIONS */}
              {effectiveRole === "support_staff" && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Support Staff Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/support-staff" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span>My Task Queue</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/roster" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Clock className="h-4 w-4 text-indigo-600" />
                        <span>View Duty Roster</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              {/* HOSPITAL ADMIN QUICK ACTIONS (Preserved) */}
              {(effectiveRole === "admin" || !effectiveRole) && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Admin Quick Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/verification" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <UserPlus className="h-4 w-4 text-teal-600" />
                        <span>Add Doctor</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/staff" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>Add Staff</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/departments" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                        <span>Create Department</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/wards-beds" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Bed className="h-4 w-4 text-cyan-600" />
                        <span>Allocate Bed</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/surgical-cases/create" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Activity className="h-4 w-4 text-purple-600" />
                        <span>Create Surgery Case</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/surgical-cases/surgeon-requests" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        <span>Request Surgeon</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/procurement/create" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <ShoppingBag className="h-4 w-4 text-orange-600" />
                        <span>Request Vendor</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/reports" className="flex items-center gap-2.5 cursor-pointer text-xs">
                        <FileBarChart className="h-4 w-4 text-sky-600" />
                        <span>Generate Report</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/emergency" className="flex items-center gap-2.5 cursor-pointer text-xs text-destructive font-semibold focus:text-destructive">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        <span>Emergency Control</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hospital-admin/ambulance" className="flex items-center gap-2.5 cursor-pointer text-xs text-rose-600 font-semibold focus:text-rose-600">
                        <Siren className="h-4 w-4 text-rose-600" />
                        <span>Dispatch Ambulance</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => signOutToRoot(router.push)}
            className="hidden h-9 gap-1.5 text-xs font-semibold sm:inline-flex"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
