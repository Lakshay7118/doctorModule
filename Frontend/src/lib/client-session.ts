"use client";

const SESSION_KEYS = [
  "qlyno.nursing-operations.v1",
  "qlyno-laboratory-session-v1",
  "qlyno.hms.auth.v1",
  "qlyno.hms.workplaceId",
];

export function clearQlynoClientSession() {
  if (typeof window === "undefined") return;

  for (const key of SESSION_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function signOutToRoot(push: (href: string) => void) {
  clearQlynoClientSession();
  push("/");
}
