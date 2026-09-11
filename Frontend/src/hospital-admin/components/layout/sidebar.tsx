"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/hospital-admin/store/store";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { setCurrentRole } from "@/hospital-admin/store/slices/nursingOperationsSlice";
import { AppUserRole } from "@/hospital-admin/lib/types/nursing-module";
import { NURSING_STORAGE_KEY } from "@/hospital-admin/store/provider";

import { getNavigationForRole, getWorkspaceMetaForRole } from "@/hospital-admin/components/layout/nav-items";
import { Avatar, AvatarFallback } from "@/hospital-admin/components/ui/avatar";
import { Button } from "@/hospital-admin/components/ui/button";
import { cn } from "@/hospital-admin/lib/utils";

const APP_USER_ROLES: AppUserRole[] = ["admin", "nurse_lead", "senior_nurse", "nurse", "support_staff", "doctor"];

function isAppUserRole(role: unknown): role is AppUserRole {
  return typeof role === "string" && APP_USER_ROLES.includes(role as AppUserRole);
}

function Logo({ collapsed, role }: { collapsed: boolean; role?: any }) {
  const meta = getWorkspaceMetaForRole(role);
  const homeHref =
    role === "nurse_lead" || role === "senior_nurse"
      ? "/hospital-admin/nurse-station"
      : role === "nurse"
      ? "/hospital-admin/nurse"
      : role === "support_staff"
      ? "/hospital-admin/support-staff"
      : "/hospital-admin/dashboard";

  return (
    <Link href={homeHref} className={cn("flex items-center gap-2.5 px-2 py-1", collapsed && "justify-center px-0")}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-active/20 text-sidebar-active">
        <span className="h-4 w-4 rounded-sm bg-sidebar-active" />
      </span>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="font-display text-[15px] font-bold tracking-tight text-sidebar-foreground leading-none">
            {meta.appName} <span className="text-sidebar-active">{meta.appSubname}</span>
          </span>
          <span className="text-[10px] text-sidebar-muted font-medium mt-0.5 leading-none">
            {meta.tagline}
          </span>
        </div>
      )}
    </Link>
  );
}

export function SidebarNav({
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const reduxRole = useSelector((state: RootState) => state.nursingOperations.currentRole);
  const [persistedRole, setPersistedRole] = useState<AppUserRole | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(NURSING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && isAppUserRole(parsed.currentRole)) {
            return parsed.currentRole as AppUserRole;
          }
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(NURSING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && isAppUserRole(parsed.currentRole)) {
            setPersistedRole(parsed.currentRole as AppUserRole);
            if (parsed.currentRole !== reduxRole) {
              dispatch(
                setCurrentRole({
                  role: parsed.currentRole,
                  userId: parsed.currentUserId,
                  userName: parsed.currentUserName,
                })
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [dispatch, reduxRole]);

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

  const navGroups = getNavigationForRole(effectiveRole);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-3 transition-all duration-300 ease-out", collapsed && "justify-center px-2")}>
        <Logo collapsed={Boolean(collapsed)} role={effectiveRole} />
        {!collapsed && onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md text-sidebar-muted transition-all duration-200 ease-out hover:bg-muted hover:text-sidebar-foreground"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-6">
            {!collapsed && (
              <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.title}
              </h2>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ease-out",
                      isActive
                        ? "bg-sidebar-active/15 text-sidebar-active font-semibold shadow-xs"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-muted/10 hover:text-sidebar-foreground",
                      collapsed && "justify-center px-0 py-2.5"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isActive && "scale-110")} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile & Workspace Selector Footer */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/hospital-admin/settings?tab=account"
          onClick={onNavigate}
          className={cn(
            "flex w-full items-center rounded-lg p-2 text-left transition-all duration-200 ease-out hover:bg-sidebar-muted/10",
            collapsed ? "justify-center p-1" : "gap-2.5"
          )}
          title={collapsed ? "Hospital Admin" : undefined}
        >
          <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
              HA
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1 truncate">
              <p className="truncate text-xs font-bold text-sidebar-foreground">Hospital Admin</p>
            </div>
          )}
        </Link>

        {collapsed && onToggleCollapse && (
          <div className="mt-2 flex justify-center border-t border-sidebar-border/50 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-sidebar-muted transition-all duration-200 ease-out hover:bg-muted hover:text-sidebar-foreground"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
