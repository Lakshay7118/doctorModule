"use client";

import * as React from "react";
import { BedDouble } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Mono, SectionHeader, Select, Table } from "./ui";
import { useReceptionistData } from "./data-context";
import { formatReceptionistDate, todayIso } from "./date-utils";

const statusTone: Record<string, "pine" | "amber" | "slate"> = {
  Admitted: "pine",
  "Awaiting Bed": "amber",
  Discharged: "slate",
};

export function IPDAdmission() {
  const { patients, doctors, wards, admissions, addAdmission } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const today = todayIso();
  const wardOptions = React.useMemo(() => (wards.length > 0 ? wards : ["General Ward"]), [wards]);
  const [form, setForm] = React.useState({
    uhid: patients[0]?.uhid ?? "",
    ward: wardOptions[0],
    bed: "",
    doctor: doctors[0]?.name ?? "",
    admittedOn: today,
  });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      uhid: current.uhid || patients[0]?.uhid || "",
      ward: current.ward || wardOptions[0] || "",
      doctor: current.doctor || doctors[0]?.name || "",
    }));
  }, [doctors, patients, wardOptions]);

  function handleAdmit(event: React.FormEvent) {
    event.preventDefault();
    const patient = patients.find((item) => item.uhid === form.uhid);
    if (!patient || !form.bed) return;

    addAdmission({
      patient: patient.name,
      uhid: patient.uhid,
      ward: form.ward,
      bed: form.bed,
      doctor: form.doctor,
      admittedOn: formatReceptionistDate(form.admittedOn),
      status: "Admitted",
    });
    setForm((current) => ({ ...current, bed: "" }));
    setModalOpen(false);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - IPD"
        title="IPD admission"
        description="Initiate inpatient admissions, assign wards and beds, allocate doctors and complete admission documentation."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <BedDouble size={16} /> New Admission
          </Button>
        }
      />

      <Modal open={modalOpen} title="Admit Patient" eyebrow="IPD Admission" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleAdmit} className="space-y-4">
          <Field label="Patient" required>
            <Select value={form.uhid} onChange={(event) => setForm((current) => ({ ...current, uhid: event.target.value }))}>
              {patients.map((patient) => (
                <option key={patient.uhid} value={patient.uhid}>{patient.name} - {patient.uhid}</option>
              ))}
            </Select>
          </Field>
          <div className="rp-grid-2">
            <Field label="Ward" required>
              <Select value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))}>
                {wardOptions.map((ward) => <option key={ward}>{ward}</option>)}
              </Select>
            </Field>
            <Field label="Bed number" required>
              <Input value={form.bed} onChange={(event) => setForm((current) => ({ ...current, bed: event.target.value }))} placeholder="e.g. ICU-05" required />
            </Field>
          </div>
          <Field label="Attending doctor" required>
            <Select value={form.doctor} onChange={(event) => setForm((current) => ({ ...current, doctor: event.target.value }))}>
              {doctors.map((doctor) => (
                <option key={doctor.name} value={doctor.name}>{doctor.name} - {doctor.department}</option>
              ))}
            </Select>
          </Field>
          <Field label="Admission date" required>
            <Input type="date" max={today} value={form.admittedOn} onChange={(event) => setForm((current) => ({ ...current, admittedOn: event.target.value }))} required />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <BedDouble size={16} /> Complete admission
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="rp-h2 !mb-0">Admissions</h2>
              <p className="rp-sub !mt-1">{admissions.length} inpatient admission records.</p>
            </div>
            <Badge tone="pine">{admissions.filter((admission) => admission.status === "Admitted").length} admitted</Badge>
          </div>
          <Table columns={["ID", "Patient", "UHID", "Ward / Bed", "Doctor", "Admitted on", "Status"]}>
            {admissions.map((admission) => (
              <tr key={admission.id}>
                <td><Mono>{admission.id}</Mono></td>
                <td className="font-medium text-ink">{admission.patient}</td>
                <td><Mono>{admission.uhid}</Mono></td>
                <td>{admission.ward} - {admission.bed}</td>
                <td>{admission.doctor}</td>
                <td>{admission.admittedOn}</td>
                <td><Badge tone={statusTone[admission.status]}>{admission.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>

        <div className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Ward occupancy</h2>
              <Badge tone="slate">Live</Badge>
            </div>
            <ul className="rp-list">
              {wardOptions.map((ward) => {
                const count = admissions.filter((admission) => admission.ward === ward && admission.status === "Admitted").length;
                return (
                  <li key={ward} className="rp-list-row !py-2">
                    <div className="min-w-0 flex-1">
                      <p className="rp-list-title truncate">{ward}</p>
                    </div>
                    <Badge tone={count > 0 ? "pine" : "slate"}>{count}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink">Admission steps</h2>
            <ol className="rp-steps mt-3">
              <li>Select a registered patient.</li>
              <li>Assign ward, bed and attending doctor.</li>
              <li>Confirm admission.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
