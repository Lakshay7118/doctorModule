"use client";

import { SectionHeading, Card, Pill } from "@/components/ui";
import { useMode } from "@/lib/mode-context";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";

export default function ReportsPage() {
  const { workContext } = useMode();
  const { appointments, diagnoses, followUps, patients, prescriptions } = useDoctorWorkflow();
  const contextAppointments = appointments.filter((appointment) => appointment.workContext === workContext);
  const contextDiagnoses = diagnoses.filter((diagnosis) => !diagnosis.workplaceId || contextAppointments.some((appointment) => appointment.workplaceId === diagnosis.workplaceId));
  const contextPatients = patients.filter((patient) => contextAppointments.some((appointment) => appointment.patientId === patient.id));
  const contextPrescriptions = prescriptions.filter((prescription) => !prescription.workplaceId || contextAppointments.some((appointment) => appointment.workplaceId === prescription.workplaceId));
  const contextFollowUps = followUps.filter((followUp) => !followUp.workplaceId || contextAppointments.some((appointment) => appointment.workplaceId === followUp.workplaceId));

  const totalConsultations = contextAppointments.filter((a) => a.status === "Completed").length;
  const completedFollowUps = contextFollowUps.filter((f) => f.status === "Completed").length;
  const followUpRate = Math.round((completedFollowUps / Math.max(contextFollowUps.length, 1)) * 100);

  const dxCounts = new Map<string, number>();
  contextDiagnoses.forEach((d) => dxCounts.set(d.description, (dxCounts.get(d.description) ?? 0) + 1));
  const topDx = [...dxCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const statusCounts = new Map<string, number>();
  contextAppointments.forEach((a) => statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1));

  const weeklyVolume = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({
    day,
    count: contextAppointments.filter((appointment) => {
      const date = new Date(`${appointment.date}T00:00:00.000Z`);
      const dayIndex = (date.getUTCDay() + 6) % 7;
      return dayIndex === index && date.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length,
  }));
  const maxWeekly = Math.max(...weeklyVolume.map((w) => w.count));

  return (
    <div>
      <SectionHeading
        eyebrow="13 - Reports"
        title="Reports"
        description={`${workContext} consultation statistics, patient trends and your personal clinical performance.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Patients", value: contextPatients.length },
          { label: "Consultations Completed", value: totalConsultations },
          { label: "Prescriptions Issued", value: contextPrescriptions.length },
          { label: "Follow-up Completion", value: `${followUpRate}%` },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5">{s.label}</p>
            <p className="font-mono text-3xl text-ink">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <h2 className="font-display text-lg text-ink mb-5">Appointment Volume This Week</h2>
          <div className="flex items-end gap-4 h-48">
            {weeklyVolume.map((w) => (
              <div key={w.day} className="flex-1 flex flex-col items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">{w.count}</span>
                <div
                  className="w-full rounded-t-md bg-brand-500"
                  style={{ height: `${(w.count / maxWeekly) * 140}px` }}
                />
                <span className="text-xs text-ink-muted">{w.day}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg text-ink mb-4">Appointment Status Mix</h2>
          <div className="space-y-3">
            {[...statusCounts.entries()].map(([status, count]) => (
              <div key={status}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-soft">{status}</span>
                  <span className="font-mono text-ink-muted">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                  <div
                    className="h-full bg-brand-400 rounded-full"
                    style={{ width: `${(count / Math.max(contextAppointments.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-lg text-ink mb-4">Most Frequent Diagnoses</h2>
        <div className="space-y-3">
          {topDx.map(([desc, count]) => (
            <div key={desc} className="flex items-center gap-3">
              <span className="text-sm text-ink-soft flex-1">{desc}</span>
              <div className="w-40 h-1.5 rounded-full bg-paper overflow-hidden hidden sm:block">
                <div className="h-full bg-clay-400 rounded-full" style={{ width: `${(count / Math.max(topDx[0]?.[1] ?? 1, 1)) * 100}%` }} />
              </div>
              <Pill tone="neutral">{count}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
