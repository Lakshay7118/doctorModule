"use client";

import * as React from "react";
import { Bell, Mail, MessageSquare, Phone, Send, UsersRound } from "lucide-react";
import { Badge, Button, Card, Field, Modal, SectionHeader, Select, Table, Textarea } from "./ui";
import { useReceptionistData } from "./data-context";
import { getAllHospitalInternalContacts, InternalContact } from "@/lib/internal-communication";

type Channel = "SMS" | "Email" | "Call" | "System";

interface InternalMessageLog {
  id: string;
  contact: string;
  team: string;
  role: string;
  channel: Channel;
  detail: string;
  time: string;
}

const channelIcon: Record<Channel, React.ReactNode> = {
  SMS: <MessageSquare size={14} />,
  Email: <Mail size={14} />,
  System: <Bell size={14} />,
  Call: <Phone size={14} />,
};

export function Communication() {
  const { doctors, notifications, sendStaffMessage } = useReceptionistData();
  const contacts = React.useMemo(() => getAllHospitalInternalContacts(doctors), [doctors]);
  const [selectedContactId, setSelectedContactId] = React.useState(contacts[0]?.id ?? "");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    contactId: contacts[0]?.id ?? "",
    channel: "System" as Channel,
    message: "",
  });
  const messageLog = React.useMemo<InternalMessageLog[]>(
    () =>
      notifications.map((notification) => ({
        id: notification.id,
        contact: notification.recipient ?? notification.title,
        team: "Hospital outbox",
        role: notification.channel,
        channel: notification.channel,
        detail: notification.detail,
        time: notification.time,
      })),
    [notifications]
  );

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0];

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const contact = contacts.find((item) => item.id === form.contactId);
    if (!contact || !form.message.trim()) return;

    sendStaffMessage({
      recipient: contact.name,
      subject: `${form.channel} sent to ${contact.name}`,
      body: form.message.trim(),
      channel: form.channel,
    });
    setSelectedContactId(contact.id);
    setForm((current) => ({ ...current, message: "" }));
    setModalOpen(false);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Communication"
        title="Communication & notifications"
        description="Connect with doctors, nurses, lab, radiology, pharmacy, billing and hospital operations staff."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Send size={16} /> New Staff Message
          </Button>
        }
      />

      <Modal open={modalOpen} title="Send Staff Message" eyebrow="Internal Communication" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleSend} className="space-y-4">
          <Field label="Staff or doctor" required>
            <Select
              value={form.contactId}
              onChange={(event) => setForm((current) => ({ ...current, contactId: event.target.value }))}
            >
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} - {contact.role} - {contact.team}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel" required>
            <Select
              value={form.channel}
              onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as Channel }))}
            >
              <option>System</option>
              <option>Call</option>
              <option>Email</option>
              <option>SMS</option>
            </Select>
          </Field>
          <Field label="Message" required>
            <Textarea
              rows={4}
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              placeholder="e.g. Please prepare room 3 for the next OPD patient."
              required
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <Send size={16} /> Send Message
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UsersRound size={16} className="text-[var(--rp-pine)]" />
            <h2 className="rp-h2 !mb-0">Hospital staff directory</h2>
          </div>
          <ul className="rp-list">
            {contacts.map((contact: InternalContact) => (
              <li key={contact.id} className="rp-list-row !items-start !py-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    setForm((current) => ({ ...current, contactId: contact.id }));
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="rp-list-title truncate">{contact.name}</p>
                  <p className="rp-list-sub truncate">{contact.role} - {contact.team}</p>
                </button>
                <Badge tone={contact.status === "Online" ? "pine" : contact.status === "Busy" ? "amber" : "slate"}>
                  {contact.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          {selectedContact && (
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="rp-h2 !mb-0">{selectedContact.name}</h2>
                  <p className="rp-sub !mt-1">{selectedContact.role} - {selectedContact.team}</p>
                </div>
                <Button
                  onClick={() => {
                    setForm((current) => ({ ...current, contactId: selectedContact.id }));
                    setModalOpen(true);
                  }}
                >
                  <Send size={16} /> Message
                </Button>
              </div>
              <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
                {selectedContact.lastMessage}
              </p>
            </Card>
          )}

          <Card>
            <h2 className="rp-h2">Internal message log</h2>
            <Table columns={["Channel", "Recipient", "Team", "Message", "Time"]}>
              {messageLog.map((message) => (
                <tr key={message.id}>
                  <td><Badge tone="slate"><span className="inline-flex items-center gap-1">{channelIcon[message.channel]} {message.channel}</span></Badge></td>
                  <td className="font-medium text-ink">{message.contact}</td>
                  <td>{message.team}</td>
                  <td>{message.detail}</td>
                  <td>{message.time}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
