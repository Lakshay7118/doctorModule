"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";

import { RootState } from "@/hospital-admin/store/store";
import { AppUserRole } from "@/hospital-admin/lib/types/nursing-module";

const STORAGE_KEY = "qlyno.nursing-operations.v1";

const HOME_ROUTES: Record<AppUserRole, string> = {
  admin: "/hospital-admin/dashboard",
  nurse_lead: "/hospital-admin/nurse-station",
  senior_nurse: "/hospital-admin/nurse-station",
  nurse: "/hospital-admin/nurse",
  support_staff: "/hospital-admin/support-staff",
  doctor: "/hospital-admin/dashboard",
};

const ROLE_ALLOWED_PREFIXES: Record<AppUserRole, string[]> = {
  admin: ["/hospital-admin"],
  nurse_lead: [
    "/hospital-admin/nurse-station",
    "/hospital-admin/wards-beds",
    "/hospital-admin/roster",
    "/hospital-admin/nurses",
    "/hospital-admin/support-staff",
    "/hospital-admin/reports",
    "/hospital-admin/nursing-audit-logs",
    "/hospital-admin/nurse-stations",
  ],
  senior_nurse: [
    "/hospital-admin/nurse-station",
    "/hospital-admin/nurse",
    "/hospital-admin/wards-beds",
    "/hospital-admin/roster",
    "/hospital-admin/nursing-audit-logs",
  ],
  nurse: ["/hospital-admin/nurse", "/hospital-admin/roster"],
  support_staff: ["/hospital-admin/support-staff", "/hospital-admin/roster"],
  doctor: ["/hospital-admin/dashboard"],
};

function canAccessRoute(pathname: string, role: AppUserRole) {
  const allowedPrefixes = ROLE_ALLOWED_PREFIXES[role] ?? ROLE_ALLOWED_PREFIXES.admin;

  return allowedPrefixes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function RouteRoleGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduxRole = useSelector(
    (state: RootState) => state.nursingOperations.currentRole
  );

  const [mounted, setMounted] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<AppUserRole>(reduxRole || "admin");

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.currentRole === "string" &&
            [
              "admin",
              "nurse_lead",
              "senior_nurse",
              "nurse",
              "support_staff",
              "doctor",
            ].includes(parsed.currentRole)
          ) {
            setResolvedRole(parsed.currentRole as AppUserRole);
            return;
          }
        }
      }
    } catch {
      // Fall back to the current Redux role.
    }

    setResolvedRole(reduxRole);
  }, [reduxRole]);

  useEffect(() => {
    if (!mounted || !pathname) return;

    if (!canAccessRoute(pathname, resolvedRole)) {
      router.replace(HOME_ROUTES[resolvedRole]);
    }
  }, [mounted, pathname, resolvedRole, router]);

  if (mounted && pathname && !canAccessRoute(pathname, resolvedRole)) {
    return null;
  }

  return <>{children}</>;
}
