"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, Menu, Search as SearchIcon, Stethoscope, Zap } from "lucide-react";
import { navItems, ModuleId } from "./receptionist/nav-config";
import { PortalStyles } from "./receptionist/portal-styles";
import { useReceptionistData } from "./receptionist/data-context";
import { Input, Badge } from "./receptionist/ui";
import { formatReceptionistDate, todayIso } from "./receptionist/date-utils";
import { signOutToRoot } from "@/lib/client-session";

import { Dashboard } from "./receptionist/Dashboard";
import { PatientDirectory } from "./receptionist/PatientDirectory";
import { Appointments } from "./receptionist/Appointments";
import { CheckIn } from "./receptionist/CheckIn";
import { OPDManagement } from "./receptionist/OPDManagement";
import { IPDAdmission } from "./receptionist/IPDAdmission";
import { VisitorManagement } from "./receptionist/VisitorManagement";
import { BillingCoordination } from "./receptionist/BillingCoordination";
import { EmergencyReception } from "./receptionist/EmergencyReception";
import { Communication } from "./receptionist/Communication";
import { Reports } from "./receptionist/Reports";
import { Settings } from "./receptionist/Settings";
import { GlobalSearch } from "./receptionist/GlobalSearch";
import { QuickActions } from "./receptionist/QuickActions";

function buildReceptionistSearchHref(query: string) {
  const trimmed = query.trim();
  return trimmed ? `/receptionist/search?q=${encodeURIComponent(trimmed)}` : "/receptionist/search";
}

function ModuleBody({
  moduleId,
  onNavigate,
  searchQuery,
  onSearchQueryChange,
}: {
  moduleId: ModuleId;
  onNavigate: (id: ModuleId) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}) {
  switch (moduleId) {
    case "dashboard":
      return <Dashboard />;
    case "patient-registration":
      return <PatientDirectory />;
    case "patient-directory":
      return <PatientDirectory />;
    case "appointments":
      return <Appointments />;
    case "check-in":
      return <CheckIn />;
    case "opd":
      return <OPDManagement />;
    case "ipd-admission":
      return <IPDAdmission />;
    case "visitors":
      return <VisitorManagement />;
    case "billing":
      return <BillingCoordination />;
    case "emergency":
      return <EmergencyReception />;
    case "communication":
      return <Communication />;
    case "reports":
      return <Reports />;
    case "settings":
      return <Settings />;
    case "search":
      return <GlobalSearch query={searchQuery} onQueryChange={onSearchQueryChange} />;
    case "quick-actions":
      return <QuickActions onNavigate={onNavigate} />;
    default:
      return <Dashboard />;
  }
}

function TopbarNotifications() {
  const { notifications } = useReceptionistData();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button className="rp-icon-btn" style={{ width: 34, height: 34 }} onClick={() => setOpen((o) => !o)} title="Notifications">
        <Bell size={16} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: 40, width: 300, background: "var(--rp-panel)",
            border: "1px solid var(--rp-line)", borderRadius: 12, boxShadow: "0 12px 28px rgb(var(--qlyno-ink-900) / 0.12)",
            padding: 10, zIndex: 30, maxHeight: 320, overflowY: "auto",
          }}
        >
          {notifications.slice(0, 6).map((n) => (
            <div key={n.id} style={{ padding: "8px 6px", borderBottom: "1px solid var(--rp-line)" }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--rp-ink)" }}>{n.title}</p>
              <p style={{ fontSize: 11.5, color: "var(--rp-slate)", marginTop: 2 }}>{n.detail}</p>
              <p style={{ fontSize: 10.5, color: "var(--rp-slate)", marginTop: 3 }}>{n.time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalShell({ moduleId, initialSearchQuery = "" }: { moduleId: ModuleId; initialSearchQuery?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);
  const todayLabel = formatReceptionistDate(todayIso());

  React.useEffect(() => {
    if (moduleId === "search") setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery, moduleId]);

  function handleNavigate(id: ModuleId) {
    const item = navItems.find((n) => n.id === id);
    setSidebarOpen(false);
    if (item) {
      router.push(item.href);
      return;
    }
    if (id === "search") router.push(buildReceptionistSearchHref(searchQuery));
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    const href = buildReceptionistSearchHref(value);
    if (moduleId === "search") {
      router.replace(href);
      return;
    }
    router.push(href);
  }

  function handleSearchFocus() {
    if (moduleId !== "search") router.push(buildReceptionistSearchHref(searchQuery));
  }

  return (
    <div className="rp-root">
      <PortalStyles />
      <div className="rp-shell">
        <aside className={`rp-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="rp-sidebar-header">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-white shadow-card">
                <Stethoscope size={17} strokeWidth={2.25} />
              </div>
              <div>
                <div className="rp-logo">Qlyno</div>
                <div className="rp-logo-sub">Receptionist Portal</div>
              </div>
            </div>
          </div>
          <nav className="rp-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === moduleId || pathname?.startsWith(item.href);
              return (
                <button
                  key={item.id}
                  className={`rp-nav-item ${active ? "active" : ""}`}
                  onClick={() => handleNavigate(item.id)}
                >
                  <span className="rp-nav-number">{item.number}</span>
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="rp-sidebar-footer">Front Desk · Counter 2</div>
        </aside>

        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,20,17,0.35)", zIndex: 30 }}
          />
        )}

        <div className="rp-main">
          <header className="rp-topbar">
            <button className="rp-icon-btn rp-sidebar-toggle" style={{ width: 34, height: 34 }} onClick={() => setSidebarOpen(true)}>
              <Menu size={16} />
            </button>
            {moduleId !== "dashboard" && (
              <button type="button" className="btn-secondary text-xs" onClick={() => handleNavigate("dashboard")}>
                <LayoutDashboard size={14} /> Dashboard
              </button>
            )}
            <button type="button" className="btn-secondary text-xs" onClick={() => router.push("/doctor/dashboard")}>
              <Stethoscope size={14} /> Doctor Module
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => signOutToRoot(router.push)}>
              <LogOut size={14} /> Sign Out
            </button>
            <form className="rp-topbar-search" onSubmit={(event) => event.preventDefault()}>
              <SearchIcon size={15} className="rp-input-icon" />
              <Input
                className="!pl-9"
                placeholder="Search patients, tokens, appointments…"
                value={searchQuery}
                onFocus={handleSearchFocus}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </form>
            <button className="rp-icon-btn" style={{ width: 34, height: 34 }} title="Quick actions" onClick={() => handleNavigate("quick-actions")}>
              <Zap size={16} />
            </button>
            <TopbarNotifications />
            <Badge tone="pine">Today - {todayLabel}</Badge>
          </header>

          <main className="rp-content">
            <ModuleBody
              moduleId={moduleId}
              onNavigate={handleNavigate}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchChange}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

// Note: state (patients, appointments, queue, etc.) lives in
// ReceptionistDataProvider, which wraps this tree from
// receptionist/layout.tsx — not here — so it persists as reception
// staff move between modules (dashboard -> registration -> check-in, ...)
// instead of resetting on every route change.
export function ReceptionistModulePage({
  moduleId,
  initialSearchQuery,
}: {
  moduleId: ModuleId;
  initialSearchQuery?: string;
}) {
  return <PortalShell moduleId={moduleId} initialSearchQuery={initialSearchQuery} />;
}
