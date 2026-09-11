"use client";

import * as React from "react";
import { Bell, Lock, Printer, Save, Settings2, UserCog } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, SectionHeader, Select } from "./ui";
import { useReceptionistData } from "./data-context";

type SettingsModal = "profile" | "printer" | "security" | null;

export function Settings() {
  const { context, settings, saveSettings } = useReceptionistData();
  const [modal, setModal] = React.useState<SettingsModal>(null);
  const [profile, setProfile] = React.useState({
    displayName: settings?.profile?.displayName ?? "Front Desk - Counter 2",
    counterNumber: settings?.profile?.counterNumber ?? "2",
    defaultDepartmentView: settings?.profile?.defaultDepartmentView ?? "All",
  });
  const [printers, setPrinters] = React.useState({
    tokenPrinter: settings?.printers?.tokenPrinter ?? "Front Desk Thermal Printer 1",
    visitorPassPrinter: settings?.printers?.visitorPassPrinter ?? "Visitor Pass Printer",
  });
  const [security, setSecurity] = React.useState({
    sessionTimeoutMinutes: settings?.security?.sessionTimeoutMinutes ?? 15,
  });
  const preferenceLabels = ["New appointment booked", "Patient checked in", "Emergency registration", "Bed allotment updates"];
  const [notificationPreferences, setNotificationPreferences] = React.useState<Record<string, boolean>>(
    settings?.notificationPreferences ?? Object.fromEntries(preferenceLabels.map((label) => [label, true]))
  );
  const enabledPermissions = Object.entries(context.permissions).filter(([, enabled]) => enabled);

  React.useEffect(() => {
    if (!settings) return;
    if (settings.profile) setProfile(settings.profile);
    if (settings.printers) {
      setPrinters({
        tokenPrinter: settings.printers.tokenPrinter,
        visitorPassPrinter: settings.printers.visitorPassPrinter,
      });
    }
    if (settings.security) setSecurity({ sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes });
    if (settings.notificationPreferences) setNotificationPreferences(settings.notificationPreferences);
  }, [settings]);

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Settings`}
        title="Settings"
        description="Review assignment ownership, active scope, notification preferences, printers and account security configurations."
      />

      <div className="rp-grid-3">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UserCog size={16} className="text-brand-700" />
            <h2 className="rp-h2 !mb-0">Reception profile</h2>
          </div>
          <p className="rp-sub mb-4">{context.organizationName} - {context.scopeLabel}.</p>
          <Button variant="secondary" onClick={() => setModal("profile")}>
            <Settings2 size={15} /> Edit Profile
          </Button>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Printer size={16} className="text-brand-700" />
            <h2 className="rp-h2 !mb-0">Printer settings</h2>
          </div>
          <p className="rp-sub mb-4">Thermal printer and visitor pass printer are configured.</p>
          <Button variant="secondary" onClick={() => setModal("printer")}>
            <Printer size={15} /> Configure
          </Button>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Lock size={16} className="text-brand-700" />
            <h2 className="rp-h2 !mb-0">Security</h2>
          </div>
          <p className="rp-sub mb-4">Password and session timeout controls.</p>
          <Button variant="secondary" onClick={() => setModal("security")}>
            <Lock size={15} /> Manage
          </Button>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={16} className="text-brand-700" />
          <h2 className="rp-h2 !mb-0">Assignment and permissions</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="eyebrow">Owner</p>
            <p className="mt-1 text-sm font-semibold text-ink">{context.ownerLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Context</p>
            <p className="mt-1 text-sm font-semibold text-ink">{context.label}</p>
          </div>
          <div>
            <p className="eyebrow">Clinical access</p>
            <Badge tone={context.permissions.clinicalAccess ? "coral" : "pine"}>
              {context.permissions.clinicalAccess ? "Enabled" : "Restricted"}
            </Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {enabledPermissions.map(([permission]) => (
            <Badge key={permission} tone="slate">{permission}</Badge>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-brand-700" />
          <h2 className="rp-h2 !mb-0">Notification preferences</h2>
        </div>
        <div className="space-y-3">
          {preferenceLabels.map((label) => (
            <label key={label} className="rp-toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={notificationPreferences[label] ?? true}
                onChange={(event) => {
                  const next = { ...notificationPreferences, [label]: event.target.checked };
                  setNotificationPreferences(next);
                  saveSettings({ notificationPreferences: next });
                }}
                className="rp-toggle"
              />
            </label>
          ))}
        </div>
      </Card>

      <Modal open={modal === "profile"} title="Reception Profile" eyebrow="Settings" onClose={() => setModal(null)} size="md">
        <div className="space-y-4">
          <Field label="Display name">
            <Input value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} />
          </Field>
          <Field label="Counter number">
            <Input value={profile.counterNumber} onChange={(event) => setProfile((current) => ({ ...current, counterNumber: event.target.value }))} />
          </Field>
          <Field label="Default department view">
            <Select value={profile.defaultDepartmentView} onChange={(event) => setProfile((current) => ({ ...current, defaultDepartmentView: event.target.value }))}>
              <option>All</option>
              <option>General Medicine</option>
              <option>Emergency</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { saveSettings({ profile }); setModal(null); }}>
              <Save size={15} /> Save profile
            </Button>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "printer"} title="Printer Settings" eyebrow="Settings" onClose={() => setModal(null)} size="md">
        <div className="space-y-4">
          <Field label="Token / slip printer">
            <Select value={printers.tokenPrinter} onChange={(event) => setPrinters((current) => ({ ...current, tokenPrinter: event.target.value }))}>
              <option>Front Desk Thermal Printer 1</option>
              <option>Front Desk Thermal Printer 2</option>
            </Select>
          </Field>
          <Field label="Visitor pass printer">
            <Select value={printers.visitorPassPrinter} onChange={(event) => setPrinters((current) => ({ ...current, visitorPassPrinter: event.target.value }))}>
              <option>Visitor Pass Printer</option>
              <option>Front Desk Thermal Printer 1</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { saveSettings({ printers }); setModal(null); }}>
              <Save size={15} /> Save printers
            </Button>
            <Button variant="secondary" onClick={() => saveSettings({ printers: { ...printers, testPrint: true } })}>Test print</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "security"} title="Account & Security" eyebrow="Settings" onClose={() => setModal(null)} size="md">
        <div className="space-y-4">
          <Field label="Change password">
            <Input type="password" placeholder="New password" />
          </Field>
          <Field label="Session timeout" hint="Auto lock the counter after inactivity">
            <Select
              value={`${security.sessionTimeoutMinutes} minutes`}
              onChange={(event) => setSecurity({ sessionTimeoutMinutes: Number.parseInt(event.target.value, 10) })}
            >
              <option>5 minutes</option>
              <option>15 minutes</option>
              <option>30 minutes</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { saveSettings({ security }); setModal(null); }}>
              <Save size={15} /> Save security
            </Button>
            <Button variant="danger" onClick={() => { saveSettings({ security: { ...security, signOutAllSessions: true } }); setModal(null); }}>
              Sign out of all sessions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
