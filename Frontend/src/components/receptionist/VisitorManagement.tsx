"use client";

import * as React from "react";
import { BadgeCheck, LogOut } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Mono, SectionHeader, Select, Table } from "./ui";
import { useReceptionistData } from "./data-context";

export function VisitorManagement() {
  const { visitors, addVisitor, checkOutVisitor, admissions, wards } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const wardOptions = React.useMemo(() => {
    const names = Array.from(new Set([...wards, ...admissions.map((admission) => admission.ward)].filter(Boolean)));
    return names.length > 0 ? names : ["General Ward"];
  }, [admissions, wards]);
  const [form, setForm] = React.useState({
    name: "",
    visiting: admissions[0]?.patient ?? "",
    ward: admissions[0]?.ward ?? wardOptions[0],
    relation: "",
  });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      visiting: current.visiting || admissions[0]?.patient || "",
      ward: current.ward || admissions[0]?.ward || wardOptions[0] || "",
    }));
  }, [admissions, wardOptions]);

  function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.visiting || !form.relation) return;
    addVisitor({ ...form });
    setForm((current) => ({ ...current, name: "", relation: "" }));
    setModalOpen(false);
  }

  const checkedIn = visitors.filter((visitor) => visitor.status === "Checked In").length;

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Visitors"
        title="Visitor management"
        description="Register visitors, issue visitor passes, maintain visitor records and monitor hospital visitation activity."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="pine">{checkedIn} on premises</Badge>
            <Button onClick={() => setModalOpen(true)}>
              <BadgeCheck size={16} /> Issue Pass
            </Button>
          </div>
        }
      />

      <Modal open={modalOpen} title="Issue Visitor Pass" eyebrow="Visitor Management" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleRegister} className="space-y-4">
          <Field label="Visitor name" required>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" required />
          </Field>
          <Field label="Visiting patient" required>
            <Select value={form.visiting} onChange={(event) => setForm((current) => ({ ...current, visiting: event.target.value }))}>
              {admissions.map((admission) => (
                <option key={admission.id} value={admission.patient}>{admission.patient} - {admission.ward}</option>
              ))}
            </Select>
          </Field>
          <div className="rp-grid-2">
            <Field label="Ward" required>
              <Select value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))}>
                {wardOptions.map((ward) => <option key={ward}>{ward}</option>)}
              </Select>
            </Field>
            <Field label="Relation" required>
              <Input value={form.relation} onChange={(event) => setForm((current) => ({ ...current, relation: event.target.value }))} placeholder="e.g. Spouse, Parent" required />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <BadgeCheck size={16} /> Issue visitor pass
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Card>
        <h2 className="rp-h2">Visiting hours & policy</h2>
        <ul className="rp-steps">
          <li>General wards: 11:00 AM - 1:00 PM and 5:00 PM - 7:00 PM.</li>
          <li>ICU: one attendant at a time, by doctor&apos;s approval only.</li>
          <li>Maximum two visitor passes per patient at any time.</li>
          <li>All passes must be returned at checkout.</li>
        </ul>
      </Card>

      <Card className="mt-5">
        <h2 className="rp-h2">Visitor log</h2>
        <Table columns={["Pass ID", "Visitor", "Visiting", "Ward", "Relation", "Issued", "Status", ""]}>
          {visitors.map((visitor) => (
            <tr key={visitor.id}>
              <td><Mono>{visitor.id}</Mono></td>
              <td className="font-medium text-ink">{visitor.name}</td>
              <td>{visitor.visiting}</td>
              <td>{visitor.ward}</td>
              <td>{visitor.relation}</td>
              <td>{visitor.passIssued}</td>
              <td><Badge tone={visitor.status === "Checked In" ? "pine" : "slate"}>{visitor.status}</Badge></td>
              <td>
                {visitor.status === "Checked In" && (
                  <button className="rp-icon-btn" title="Check out" onClick={() => checkOutVisitor(visitor.id)}>
                    <LogOut size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
