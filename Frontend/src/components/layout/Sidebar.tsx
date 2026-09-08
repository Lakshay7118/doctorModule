"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, ClipboardList, TestTube, Truck, Microscope, FileCheck2,
  ShieldCheck, Boxes, Wallet, MessageSquare, BarChart3, ChevronDown, ChevronsLeft,
  ChevronsRight, FlaskConical, LogOut, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAVIGATION, type NavItem } from "@/config/navigation";
import { useDemo } from "@/state/demo-context";
import { TENANT_MODE_CONFIG } from "@/config/tenant-modes";

const ICONS = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "clipboard-list": ClipboardList,
  "test-tube": TestTube,
  truck: Truck,
  microscope: Microscope,
  "file-check-2": FileCheck2,
  "shield-check": ShieldCheck,
  boxes: Boxes,
  wallet: Wallet,
  "message-square": MessageSquare,
  "bar-chart-3": BarChart3,
} as const;

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) return true;
  return pathname.startsWith(item.href + "/");
}

function NavGroupBlock({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { billingEnabled, roleId, session } = useDemo();
  const [openId, setOpenId] = useState<string | null>(() => {
    for (const group of NAVIGATION) {
      const match = group.items.find((i) => isActive(pathname, i));
      if (match) return match.id;
    }
    return null;
  });

  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-2">
      {NAVIGATION.filter((group) => group.id !== "lab-management" || (session?.administrativeRoles.length ?? 0) > 0).map((group) => (
        <div key={group.id} className="mb-4">
          {!collapsed && (
            <p className="px-2 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{group.label}</p>
          )}
          <ul className="space-y-1">
            {group.items
              .filter((item) => (!item.billingGated || billingEnabled) && ((session?.administrativeRoles.length ?? 0) > 0 || isAllowedForRole(item.id, roleId)))
              .map((item, itemIndex) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item);
                const expanded = openId === item.id;
                return (
                  <li key={item.id}>
                    <div className="group relative flex items-center">
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                          active ? "bg-brand-blue text-white shadow-sm" : "text-text-muted hover:bg-brand-50 hover:text-text-main",
                          collapsed && "justify-center"
                        )}
                      >
                        {!collapsed && <span className={cn("w-5 text-[10px] font-medium", active ? "text-white/65" : "text-text-muted/60")}>{String(itemIndex + 1).padStart(2, "0")}</span>}
                        <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                      {!collapsed && item.children && item.children.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label} submenu`}
                          onClick={() => setOpenId(expanded ? null : item.id)}
                          className="rounded p-1.5 text-text-muted hover:bg-app-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                        </button>
                      )}
                      {collapsed && item.children && item.children.length > 0 && (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden min-w-[190px] rounded-lg border border-app-border bg-app-surface p-1.5 shadow-lg group-hover:block"
                        >
                          <p className="px-2.5 py-1 text-xs font-semibold text-text-main">{item.label}</p>
                          {item.children.filter((child) => child.href !== "/integrations/hms-billing" || session?.billingOwner === "HMS_CENTRAL").map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="pointer-events-auto block rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:bg-app-bg hover:text-text-main"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    {!collapsed && expanded && item.children && (
                      <ul className="ml-[26px] mt-0.5 space-y-0.5 border-l border-app-border pl-3">
                        {item.children.filter((child) => child.href !== "/integrations/hms-billing" || session?.billingOwner === "HMS_CENTRAL").map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onNavigate}
                                aria-current={childActive ? "page" : undefined}
                                className={cn(
                                  "block rounded-lg px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                                  childActive ? "text-brand-blue" : "text-text-muted hover:bg-app-bg hover:text-text-main"
                                )}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function isAllowedForRole(itemId: string, roleId: string) {
  if (["team-access", "roles-permissions", "site-department-scope", "access-audit"].includes(itemId)) return true;
  const scoped: Record<string, string[]> = {
    technologist: ["command-center", "collection-specimens", "workbench-analyzers", "results-reports", "quality"],
    phlebotomist: ["command-center", "patients-network", "orders-catalog", "collection-specimens", "logistics-referrals"],
    accessioning: ["command-center", "orders-catalog", "collection-specimens", "logistics-referrals"],
    reception_cashier: ["command-center", "patients-network", "orders-catalog", "collection-specimens", "commercial-billing", "portals-communication"],
    inventory_procurement: ["command-center", "inventory-equipment"],
    quality_manager: ["command-center", "quality", "analytics-administration"],
  };
  return !scoped[roleId] || scoped[roleId].includes(itemId);
}

function SidebarContent({ collapsed, onNavigate, onToggleCollapse, showCollapseControl, onSignOut }: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseControl?: boolean;
  onSignOut: () => void;
}) {
  const { tenantMode, session } = useDemo();
  const modeConfig = TENANT_MODE_CONFIG[tenantMode];

  return (
    <div className="flex h-full flex-col bg-app-sidebar">
      <div className={cn("flex items-center gap-3 border-b border-app-border px-5 py-[17px]", collapsed && "justify-center px-2")}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold leading-none text-text-main">Qlyno</p>
            <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">{session?.organizationName ?? "Laboratory Portal"}</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-app-border px-5 py-3">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-brand-blue">
            {modeConfig.id === "hospital" ? "HMS Integrated" : modeConfig.id === "b2b" ? "Reference / B2B" : modeConfig.id === "hybrid" ? "Hybrid Ops" : "Standalone"} mode
          </span>
        </div>
      )}

      <NavGroupBlock collapsed={collapsed} onNavigate={onNavigate} />

      <div className={cn("border-t border-app-border p-3", collapsed && "flex flex-col items-center")}>
        {showCollapseControl && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-app-border bg-white px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-app-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : (
              <>
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" /> Collapse
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-text-muted hover:bg-app-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
            collapsed ? "justify-center w-full" : "w-full"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, setMobileNavOpen, logout } = useDemo();
  const router = useRouter();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-[100dvh] shrink-0 border-r border-app-border transition-[width] duration-200 lg:block",
          sidebarCollapsed ? "w-sidebar-collapsed" : "w-sidebar"
        )}
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          showCollapseControl
          onSignOut={() => { logout(); router.push("/sign-in"); }}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Navigation menu" className="relative h-full w-[280px] max-w-[85vw] bg-app-sidebar shadow-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 z-10 rounded-full bg-white p-1.5 text-text-muted shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <SidebarContent collapsed={false} onNavigate={() => setMobileNavOpen(false)} onSignOut={() => { logout(); setMobileNavOpen(false); router.push("/sign-in"); }} />
          </div>
        </div>
      )}
    </>
  );
}
