import { ConsultationPatientWorkspace } from "@/components/consultation-patient-workspace";

export default function ConsultationPage({
  searchParams,
}: {
  searchParams?: { patient?: string | string[]; appointment?: string | string[] };
}) {
  const patientParam = Array.isArray(searchParams?.patient)
    ? searchParams?.patient[0]
    : searchParams?.patient;
  const appointmentParam = Array.isArray(searchParams?.appointment)
    ? searchParams?.appointment[0]
    : searchParams?.appointment;

  return <ConsultationPatientWorkspace initialPatientId={patientParam} initialAppointmentId={appointmentParam} />;
}
