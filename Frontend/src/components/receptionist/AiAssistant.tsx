"use client";

import * as React from "react";
import { MessageSquareWarning, Route, Sparkles } from "lucide-react";
import { Badge, Card, SectionHeader } from "./ui";
import { useReceptionistData } from "./data-context";

const assistantRows = [
  ["Clinic/hospital timing", "Answer from approved organization information."],
  ["Doctor availability", "Show permitted availability only."],
  ["Appointment booking", "Assist with slot selection and booking."],
  ["Lab status", "Explain administrative status only."],
  ["Report interpretation", "Route to clinician."],
  ["Medical question", "Route to doctor, nurse or clinical team."],
  ["Emergency message", "Trigger emergency escalation workflow."],
  ["Task creation", "Create or route an administrative task."],
];

export function AiAssistant() {
  const { context } = useReceptionistData();

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - AI`}
        title="AI administrative assistant"
        description="Reception-facing guidance for approved information, routing and repetitive administrative work."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--rp-pine)]" />
            <h2 className="rp-h2 !mb-0">Allowed assistant responses</h2>
          </div>
          <div className="space-y-3">
            {assistantRows.map(([query, response]) => (
              <div key={query} className="rounded-md border border-line bg-paper/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--rp-ink)]">{query}</p>
                  <Badge tone={query.includes("interpretation") || query.includes("Medical") ? "amber" : "pine"}>Configured</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--rp-slate)]">{response}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rp-card-alert">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareWarning size={16} className="text-[var(--rp-coral)]" />
            <h2 className="rp-h2 !mb-0">Clinical boundary</h2>
          </div>
          <div className="space-y-2">
            {context.boundaries.map((boundary) => (
              <p key={boundary} className="flex gap-2 text-sm text-[var(--rp-ink-soft)]">
                <Route size={14} className="mt-0.5 shrink-0 text-[var(--rp-coral)]" />
                <span>{boundary}</span>
              </p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
