"use client";

import * as React from "react";
import { BadgeCheck, CalendarPlus, Search, Siren, TicketCheck, UserPlus } from "lucide-react";
import { Card, SectionHeader } from "./ui";
import type { ModuleId } from "./nav-config";
import { useReceptionistData } from "./data-context";

const actions: { id: ModuleId; label: string; description: string; icon: React.ReactNode; tone: "pine" | "coral" }[] = [
  { id: "patient-directory", label: "Register patient", description: "Open patients and add a new UHID", icon: <UserPlus size={20} />, tone: "pine" },
  { id: "appointments", label: "Book appointment", description: "Schedule against doctor availability", icon: <CalendarPlus size={20} />, tone: "pine" },
  { id: "check-in", label: "Check-in", description: "Issue a token and notify the doctor", icon: <TicketCheck size={20} />, tone: "pine" },
  { id: "emergency", label: "Emergency registration", description: "Fast-track a critical arrival", icon: <Siren size={20} />, tone: "coral" },
  { id: "visitors", label: "Issue visitor pass", description: "Register a ward visitor", icon: <BadgeCheck size={20} />, tone: "pine" },
  { id: "search", label: "Global search", description: "Find any patient, token or record", icon: <Search size={20} />, tone: "pine" },
];

export function QuickActions({ onNavigate }: { onNavigate: (id: ModuleId) => void }) {
  const { context } = useReceptionistData();
  const allowed = new Set(context.allowedModules);
  const availableActions = actions.filter((action) => allowed.has(action.id));

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Quick actions`}
        title="Quick actions"
        description="Quickly access the actions permitted for this receptionist context."
      />

      <div className="rp-quick-grid">
        {availableActions.map((action) => (
          <button key={action.id} className={`rp-quick-card rp-quick-card-${action.tone}`} onClick={() => onNavigate(action.id)}>
            <span className={`rp-quick-icon rp-quick-icon-${action.tone}`}>{action.icon}</span>
            <span className="rp-quick-label">{action.label}</span>
            <span className="rp-quick-desc">{action.description}</span>
          </button>
        ))}
      </div>

      <Card className="mt-5">
        <p className="rp-sub">
          Quick actions follow the active assignment scope: simple for solo doctor, coordinated for clinic,
          and operationally broader for hospital reception.
        </p>
      </Card>
    </div>
  );
}
