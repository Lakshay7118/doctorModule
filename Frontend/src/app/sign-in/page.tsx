"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/state/demo-context";
import { DEMO_ACCOUNTS } from "@/data/mock/laboratory-sessions";
import { loginHms } from "@/hospital-admin/lib/hms-api";
import { BadgeCheck, Bed, Building2, CreditCard, Eye, EyeOff, FlaskConical, LogIn, Mail, ShieldCheck, Stethoscope } from "lucide-react";

type LoginRole = "hospital_admin" | "doctor" | "receptionist" | "nurse" | "billing" | "laboratory";

const roleOptions: Array<{
  id: LoginRole;
  title: string;
  description: string;
  email: string;
  target: string;
  icon: typeof ShieldCheck;
}> = [
  {
    id: "hospital_admin",
    title: "Hospital Admin",
    description: "Hospital command center, departments, wards, assets, reports and staff controls.",
    email: "admin@sunrise.example",
    target: "/hospital-admin/dashboard",
    icon: ShieldCheck,
  },
  {
    id: "doctor",
    title: "Doctor",
    description: "Doctor dashboard, schedule, appointments, consultation, prescriptions and records.",
    email: "doctor@hospital.example",
    target: "/doctor/dashboard",
    icon: Stethoscope,
  },
  {
    id: "receptionist",
    title: "Receptionist",
    description: "Front desk dashboard, registration, appointments, check-in, billing coordination.",
    email: "reception@hospital.example",
    target: "/receptionist/dashboard",
    icon: BadgeCheck,
  },
  {
    id: "nurse",
    title: "Nurse",
    description: "Bedside patient workspace, assigned patients, station activity and shift roster.",
    email: "nurse@hospital.example",
    target: "/hospital-admin/nurse",
    icon: Bed,
  },
  {
    id: "billing",
    title: "Billing",
    description: "Billing staff portal for invoices, payments, refunds, insurance and reconciliation.",
    email: "billing@hospital.example",
    target: "/billing-staff/dashboard",
    icon: CreditCard,
  },
  {
    id: "laboratory",
    title: "Laboratory",
    description: "Laboratory dashboard, orders, accessioning, workbench, results, quality and inventory.",
    email: "lab@qlyno.health",
    target: "/dashboard",
    icon: FlaskConical,
  },
];

function persistRole(role: LoginRole) {
  if (typeof window === "undefined") return;

  if (role === "hospital_admin") {
    window.localStorage.setItem(
      "qlyno.nursing-operations.v1",
      JSON.stringify({
        loginRole: "admin",
        currentRole: "admin",
        currentUserId: "usr-admin-1",
        currentUserName: "Hospital Admin",
      })
    );
    return;
  }

  if (role === "nurse") {
    window.localStorage.setItem(
      "qlyno.nursing-operations.v1",
      JSON.stringify({
        loginRole: "nurse",
        currentRole: "nurse",
        currentUserId: "nurse-3",
        currentUserName: "Nurse Rahul Shinde",
      })
    );
  }
}

function defaultPasswordForRole(role: LoginRole) {
  return role === "laboratory" ? "demo@qlyno2026" : "QlynoDemo!2026";
}

export default function SignInPage() {
  const router = useRouter();
  const { login } = useDemo();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [selectedRole, setSelectedRole] = useState<LoginRole>("hospital_admin");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState(defaultPasswordForRole("hospital_admin"));
  const activeRole = roleOptions.find((role) => role.id === selectedRole) ?? roleOptions[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim() || isSigningIn) return;
    setLoginError("");
    setIsSigningIn(true);
    if (activeRole.id === "laboratory") {
      if (password !== "demo@qlyno2026") {
        setLoginError("Use the demo password: demo@qlyno2026");
        setIsSigningIn(false);
        return;
      }
      const account = DEMO_ACCOUNTS.find((item) => item.session.role === "lab_director" && item.session.laboratoryProfile === "HOSPITAL_INTEGRATED");
      try {
        if (!account || !(await login(account.credentials, true))) {
          setLoginError("Unable to sign in to the laboratory demo. Please try again.");
          return;
        }
      } catch {
        setLoginError("Unable to save your laboratory session. Please try again.");
        return;
      } finally {
        setIsSigningIn(false);
      }
    } else {
      try {
        await loginHms({ identifier: activeRole.email, password, tenantSlug: "sunrise-hospital", remember: true });
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : "Unable to sign in to the backend.");
        setIsSigningIn(false);
        return;
      }
    }
    persistRole(activeRole.id);
    router.push(activeRole.target);
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden min-h-[620px] flex-col justify-between rounded-md bg-brand-900 p-8 text-white shadow-lift lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white">
              <Stethoscope size={22} />
            </span>
            <div>
              <h1 className="font-display text-3xl leading-tight">Qlyno</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-100">Unified Healthcare Portal</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand-100">One login</p>
            <h2 className="mt-3 font-display text-4xl leading-tight">All operational modules in one workspace.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-brand-100">
              Select the role, sign in once, and continue to the correct dashboard for hospital admin, doctor, receptionist, nurse, billing or laboratory staff.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-brand-50">
            <Building2 size={14} /> Meridian Family Clinic
          </span>
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="mb-6">
            <p className="eyebrow">Secure role access</p>
            <h2 className="mt-1 font-display text-3xl text-ink">Sign in to Qlyno</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Choose your module role and continue with the demo workspace credentials.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {roleOptions.map((role) => {
              const Icon = role.icon;
              const selected = role.id === selectedRole;
              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => { setSelectedRole(role.id); setPassword(defaultPasswordForRole(role.id)); setLoginError(""); }}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    selected ? "border-brand-200 bg-brand-50 text-brand-800" : "border-line bg-paper/70 text-ink-soft hover:bg-brand-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={17} />
                    <span className="text-sm font-semibold">{role.title}</span>
                  </span>
                  <span className="mt-2 block min-h-10 text-xs leading-5 text-ink-muted">{role.description}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Work email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
                <input value={activeRole.email} readOnly className="input-field pl-9 font-mono text-sm" />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Password</span>
              <span className="relative block">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={passwordVisible ? "text" : "password"}
                  className="input-field pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-paper hover:text-ink"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {loginError && <p role="alert" className="text-sm text-red-600">{loginError}</p>}
            <button type="submit" disabled={isSigningIn} className="btn-primary w-full justify-center">
              <LogIn size={16} /> {isSigningIn ? "Signing in..." : `Sign In as ${activeRole.title}`}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
