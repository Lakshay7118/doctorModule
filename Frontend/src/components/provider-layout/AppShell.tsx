"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogOut, X, Stethoscope } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { doctorWorkspaceNav, clinicOperationsNav } from "./nav-config";
import { useMode } from "@/lib/mode-context";
import { DoctorAiAssistant } from "@/components/doctor-workflow";

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { workContext } = useMode();
  const isReceptionistPortal = pathname?.startsWith("/receptionist");
  const isAuthPage = pathname?.startsWith("/sign-in");
  const isImportedStaffPortal = pathname?.startsWith("/hospital-admin") || pathname?.startsWith("/billing-staff");
  const mobileNavItems = [...doctorWorkspaceNav, ...(workContext === "clinic" ? clinicOperationsNav : [])];

  if (isReceptionistPortal || isAuthPage || isImportedStaffPortal) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-line bg-surface p-4 overflow-y-auto shadow-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-brand-500 flex items-center justify-center">
                  <Stethoscope size={17} className="text-white" />
                </div>
                <span className="font-display text-lg">Qlyno</span>
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="space-y-0.5">
              {mobileNavItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx("nav-link", active && "active")}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <Link href="/" onClick={() => setMobileOpen(false)} className="nav-link">
                <LogOut size={16} />
                Sign Out
              </Link>
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
      <DoctorAiAssistant />
    </div>
  );
}
