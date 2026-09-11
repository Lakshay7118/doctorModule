"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Activity, Building2, Check, ChevronsUpDown, Hospital, Stethoscope } from "lucide-react";
import { doctorWorkspaceNav, clinicOperationsNav } from "./nav-config";
import { useMode } from "@/lib/mode-context";
import { AvailabilityDot, Avatar } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { workplaceToContext } from "@/lib/doctor-workflow-types";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedWorkplaceId, workContext, setSelectedWorkplaceId, setWorkContext } = useMode();
  const { currentDoctorName, doctors, workplaces } = useDoctorWorkflow();
  const [contextOpen, setContextOpen] = useState(false);
  const currentDoctor = doctors.find((doctor) => doctor.name === currentDoctorName) ?? doctors[0];
  const displayDoctorName = currentDoctor?.name ?? currentDoctorName;
  const displayDoctorInitials = currentDoctor?.avatarInitials ?? initials(displayDoctorName);
  const workplaceOptions = workplaces.map((workplace) => ({
    workplace,
    value: workplaceToContext(workplace.type),
    label: workplace.name,
    detail: workplace.location ?? workplace.department ?? workplace.type,
    icon: workplace.type === "hospital" ? Hospital : Building2,
  }));
  const activeWorkplace =
    workplaceOptions.find((item) => item.workplace.id === selectedWorkplaceId) ??
    workplaceOptions[0] ?? {
      workplace: { id: "", name: "Loading workspace", type: "clinic" as const, status: "Pending" as const },
      value: "clinic" as const,
      label: "Loading workspace",
      detail: "Syncing records",
      icon: Building2,
    };
  const ActiveIcon = activeWorkplace.icon;

  function selectWorkplace(option: (typeof workplaceOptions)[number]) {
    setSelectedWorkplaceId(option.workplace.id);
    setWorkContext(option.value);
    setContextOpen(false);
    if (option.value === "hospital" && pathname?.startsWith("/clinic")) {
      router.push("/doctor/dashboard");
    }
  }

  function renderNavItems(items: typeof doctorWorkspaceNav) {
    return items.map((item) => {
      const active = pathname === item.href || pathname?.startsWith(item.href + "/");
      const Icon = item.icon;
      return (
        <Link key={item.href} href={item.href} className={clsx("nav-link", active && "active")}>
          <Icon size={16} strokeWidth={2} />
          <span className="truncate">{item.label}</span>
          <span className="ml-auto font-mono text-[10px] opacity-45">{item.moduleNumber}</span>
        </Link>
      );
    });
  }

  return (
    <aside className="hidden lg:flex flex-col w-[280px] shrink-0 h-screen sticky top-0 border-r border-line bg-surface/92 backdrop-blur">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
        <div className="w-9 h-9 rounded-md bg-brand-500 flex items-center justify-center shadow-card">
          <Stethoscope size={17} className="text-white" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-xl leading-none text-ink">Qlyno</p>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Provider Portal</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <p className="px-1 mb-1.5 eyebrow">Workplace</p>
          <button
            type="button"
            onClick={() => setContextOpen((value) => !value)}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-3 text-left shadow-card hover:bg-paper transition-colors"
            aria-expanded={contextOpen}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                <ActiveIcon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink truncate">{activeWorkplace.label}</span>
                <span className="block text-[11px] text-ink-muted truncate">{activeWorkplace.detail}</span>
              </span>
            </span>
            <ChevronsUpDown size={14} className="text-ink-faint shrink-0" />
          </button>

          {contextOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" onClick={() => setContextOpen(false)} />
              <div className="absolute left-0 right-0 z-20 mt-1.5 rounded-card border border-line bg-white p-1.5 shadow-lift">
                {workplaceOptions.map((item) => {
                  const Icon = item.icon;
                  const selected = activeWorkplace.workplace.id === item.workplace.id;
                  return (
                    <button
                      key={item.workplace.id}
                      type="button"
                      onClick={() => selectWorkplace(item)}
                      className={clsx(
                        "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                        selected ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-paper"
                      )}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white">
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold truncate">{item.label}</span>
                        <span className="block text-[11px] text-ink-muted truncate">
                          {item.workplace.type} - {item.detail}
                        </span>
                      </span>
                      {selected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 mb-1.5 eyebrow">Doctor Workspace</p>
          <div className="space-y-0.5">{renderNavItems(doctorWorkspaceNav)}</div>
        </div>

        {workContext === "clinic" && (
          <div>
            <p className="px-3 mb-1.5 eyebrow">Clinic Operations</p>
            <div className="space-y-0.5">{renderNavItems(clinicOperationsNav)}</div>
          </div>
        )}

      </nav>

      {/* Profile */}
      <div className="border-t border-line p-3">
        <div className="mb-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-700">
            <Activity size={12} /> Live workspace
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {activeWorkplace.label}
          </p>
        </div>
        <Link
          href="/doctor/settings"
          className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-paper transition-colors"
        >
          <Avatar initials={displayDoctorInitials} size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink truncate">{displayDoctorName}</p>
            <AvailabilityDot status={currentDoctor?.availability ?? "Available"} />
          </div>
        </Link>
      </div>
    </aside>
  );
}
