"use client";

import { useEffect, useState } from "react";
import { Building2, Copy, Hospital, MonitorSmartphone, Plus, Trash2 } from "lucide-react";
import { WorkplaceBadge } from "@/components/doctor-workflow";
import { SectionHeading, Card, Avatar, Field, Pill, TimePicker, SectionSkeleton, Skeleton } from "@/components/ui";
import { getBackendState, saveBackendState } from "@/lib/api-client";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { useMode } from "@/lib/mode-context";

const tabs = ["Profile", "My Workplaces", "Consultation Preferences", "Notifications", "Security"] as const;
type Tab = (typeof tabs)[number];

const preferenceLabels = [
  "Allow video consultations",
  "Show me as available for walk-ins",
  "Require vitals before consultation starts",
  "Auto-suggest ICD codes while typing diagnosis",
] as const;

const notificationLabels = [
  "New appointment booked",
  "Patient checked in",
  "Lab report ready",
  "Follow-up due today",
  "Emergency alert",
  "Direct message from staff",
] as const;

type PreferenceLabel = (typeof preferenceLabels)[number];
type NotificationLabel = (typeof notificationLabels)[number];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type WeekDay = (typeof weekDays)[number];

interface WorkingHour {
  day: WeekDay;
  open: boolean;
  startTime: string;
  endTime: string;
}

interface TreatmentService {
  id: string;
  name: string;
  fee: string;
}

interface DoctorSettingsState {
  profile: {
    name: string;
    email: string;
    specialty: string;
    qualifications: string;
    experienceYears: number;
    clinicName: string;
    awards: string;
    languages: string;
    youtubePodcastUrl: string;
    photoUrl: string;
    publicProfileUrl: string;
    phone: string;
    emergencyPhone: string;
    country: string;
    state: string;
    city: string;
    address: string;
    bookingPreference: string;
    appointmentSlotMinutes: string;
    freeFollowUpDays: string;
    consultationFee: string;
    treatments: TreatmentService[];
    profileTags: string[];
    workingHours: WorkingHour[];
    about: string;
    bio: string;
  };
  consultationLength: string;
  bufferMinutes: string;
  preferences: Record<PreferenceLabel, boolean>;
  notifications: Record<NotificationLabel, { inApp: boolean; whatsapp: boolean }>;
  twoFactorEnabled: boolean;
}

function buildDefaultNotifications() {
  return notificationLabels.reduce(
    (acc, label) => ({
      ...acc,
      [label]: { inApp: true, whatsapp: true },
    }),
    {} as DoctorSettingsState["notifications"]
  );
}

const defaultSettings: DoctorSettingsState = {
  profile: {
    name: "Doctor",
    email: "",
    specialty: "",
    qualifications: "",
    experienceYears: 0,
    clinicName: "",
    awards: "",
    languages: "",
    youtubePodcastUrl: "",
    photoUrl: "",
    publicProfileUrl: "",
    phone: "",
    emergencyPhone: "",
    country: "",
    state: "",
    city: "",
    address: "",
    bookingPreference: "Slot Based Booking",
    appointmentSlotMinutes: "15",
    freeFollowUpDays: "7",
    consultationFee: "1000",
    treatments: [{ id: "service-1", name: "General Medicine Consultation", fee: "1000" }],
    profileTags: ["internal medicine", "family physician"],
    workingHours: weekDays.map((day) => ({
      day,
      open: day !== "Sunday",
      startTime: "09:00",
      endTime: "17:00",
    })),
    about: "",
    bio: "",
  },
  consultationLength: "15",
  bufferMinutes: "5",
  preferences: {
    "Allow video consultations": true,
    "Show me as available for walk-ins": true,
    "Require vitals before consultation starts": true,
    "Auto-suggest ICD codes while typing diagnosis": true,
  },
  notifications: buildDefaultNotifications(),
  twoFactorEnabled: false,
};

export default function SettingsPage() {
  const { selectedWorkplaceId } = useMode();
  const { backendDoctorId, currentDoctorName, workplaces, isLoadingWorkflow } = useDoctorWorkflow();
  const [tab, setTab] = useState<Tab>("Profile");
  const [settings, setSettings] = useState<DoctorSettingsState>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const stateEntityId = backendDoctorId ?? "doctor-settings";

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSettings(true);

    getBackendState<Partial<DoctorSettingsState>>("doctor-settings", stateEntityId, selectedWorkplaceId)
      .then((state) => {
        if (cancelled || !state) return;
        setSettings((prev) => ({
          ...prev,
          ...state,
          profile: { ...prev.profile, ...state.profile },
          preferences: { ...prev.preferences, ...state.preferences },
          notifications: { ...prev.notifications, ...state.notifications },
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          setSyncMessage(`Database sync failed: ${error instanceof Error ? error.message : "settings could not be loaded."}`);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkplaceId, stateEntityId]);

  useEffect(() => {
    if (!currentDoctorName || currentDoctorName === "Doctor") return;
    setSettings((prev) => (prev.profile.name === "Doctor" ? { ...prev, profile: { ...prev.profile, name: currentDoctorName } } : prev));
  }, [currentDoctorName]);

  if (isLoadingWorkflow || isLoadingSettings) {
    return (
      <div>
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Card padded={false} className="h-fit lg:col-span-1">
            <div className="space-y-2 p-1.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          </Card>
          <Card className="lg:col-span-3">
            <div className="mb-6 flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
            <Skeleton className="mt-5 h-24 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  function updateProfile<K extends keyof DoctorSettingsState["profile"]>(
    field: K,
    value: DoctorSettingsState["profile"][K]
  ) {
    setSettings((prev) => ({
      ...prev,
      profile: { ...prev.profile, [field]: value },
    }));
  }

  function updateWorkingHour(index: number, changes: Partial<WorkingHour>) {
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        workingHours: prev.profile.workingHours.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...changes } : item
        ),
      },
    }));
  }

  function addTreatment() {
    updateProfile("treatments", [
      ...settings.profile.treatments,
      { id: `service-${Date.now()}`, name: "", fee: "" },
    ]);
  }

  function updateTreatment(id: string, field: keyof TreatmentService, value: string) {
    updateProfile(
      "treatments",
      settings.profile.treatments.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeTreatment(id: string) {
    updateProfile(
      "treatments",
      settings.profile.treatments.filter((item) => item.id !== id)
    );
  }

  function addTag() {
    updateProfile("profileTags", [...settings.profile.profileTags, ""]);
  }

  function updateTag(index: number, value: string) {
    updateProfile(
      "profileTags",
      settings.profile.profileTags.map((tag, tagIndex) => (tagIndex === index ? value : tag))
    );
  }

  function removeTag(index: number) {
    updateProfile(
      "profileTags",
      settings.profile.profileTags.filter((_, tagIndex) => tagIndex !== index)
    );
  }

  async function copyPublicProfileUrl() {
    if (!settings.profile.publicProfileUrl) return;
    await navigator.clipboard?.writeText(settings.profile.publicProfileUrl);
    setSaved(true);
    setSyncMessage("Public profile URL copied.");
    setTimeout(() => setSaved(false), 2000);
  }

  function updatePreference(label: PreferenceLabel, checked: boolean) {
    setSettings((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [label]: checked },
    }));
  }

  function updateNotification(label: NotificationLabel, channel: "inApp" | "whatsapp", checked: boolean) {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [label]: { ...prev.notifications[label], [channel]: checked },
      },
    }));
  }

  async function save() {
    setSaved(false);
    setSyncMessage("");

    try {
      await saveBackendState("doctor-settings", stateEntityId, settings, selectedWorkplaceId);
      setSyncMessage("Saved to database");
    } catch (error) {
      setSyncMessage(`Database sync failed: ${error instanceof Error ? error.message : "settings were not saved."}`);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="15 - Settings"
        title="Settings"
        description="Manage your doctor profile, consultation preferences, notifications and account security."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card padded={false} className="lg:col-span-1 h-fit">
          <div className="p-1.5">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t ? "bg-brand-500 text-white" : "text-ink-soft hover:bg-paper"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3">
          <Card>
            {tab === "Profile" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar initials={settings.profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()} size={64} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{settings.profile.name}</p>
                      <p className="text-xs text-ink-muted">{settings.profile.specialty || "Specialty not added"}</p>
                    </div>
                  </div>
                  <Pill tone="sage">Verified</Pill>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Profile Photo URL">
                    <input
                      value={settings.profile.photoUrl}
                      onChange={(event) => updateProfile("photoUrl", event.target.value)}
                      placeholder="https://..."
                      className="input-field"
                    />
                  </Field>
                  <Field label="Public Profile URL">
                    <div className="flex gap-2">
                      <input
                        value={settings.profile.publicProfileUrl}
                        onChange={(event) => updateProfile("publicProfileUrl", event.target.value)}
                        placeholder="https://qlyno.com/doctor/..."
                        className="input-field"
                      />
                      <button type="button" onClick={copyPublicProfileUrl} className="btn-secondary px-3" aria-label="Copy public profile URL">
                        <Copy size={14} />
                      </button>
                    </div>
                  </Field>
                </div>

                <div>
                  <h2 className="font-display text-xl text-ink">Personal Information</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name">
                    <input
                      value={settings.profile.name}
                      onChange={(event) => updateProfile("name", event.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={settings.profile.email}
                        onChange={(event) => updateProfile("email", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Specialization">
                    <input
                      value={settings.profile.specialty}
                      onChange={(event) => updateProfile("specialty", event.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Experience (Years)">
                      <input
                        value={settings.profile.experienceYears}
                        onChange={(event) => updateProfile("experienceYears", Number(event.target.value))}
                        type="number"
                        min="0"
                        className="input-field"
                      />
                    </Field>
                    <Field label="Clinic Name">
                      <input
                        value={settings.profile.clinicName}
                        onChange={(event) => updateProfile("clinicName", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Qualifications & Education" className="sm:col-span-2">
                    <input
                      value={settings.profile.qualifications}
                      onChange={(event) => updateProfile("qualifications", event.target.value)}
                      className="input-field"
                    />
                    </Field>
                    <Field label="Awards & Recognition" className="sm:col-span-2">
                      <textarea
                        rows={3}
                        value={settings.profile.awards}
                        onChange={(event) => updateProfile("awards", event.target.value)}
                        placeholder="Awards, publications, honors, memberships..."
                        className="input-field resize-none"
                      />
                    </Field>
                    <Field label="Languages Spoken" className="sm:col-span-2">
                      <input
                        value={settings.profile.languages}
                        onChange={(event) => updateProfile("languages", event.target.value)}
                        placeholder="English, Hindi..."
                        className="input-field"
                      />
                    </Field>
                    <Field label="YouTube Podcast Link" className="sm:col-span-2">
                      <input
                        value={settings.profile.youtubePodcastUrl}
                        onChange={(event) => updateProfile("youtubePodcastUrl", event.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="input-field"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-xl text-ink">Contact Information</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Phone">
                      <input
                        value={settings.profile.phone}
                        onChange={(event) => updateProfile("phone", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Emergency">
                      <input
                        value={settings.profile.emergencyPhone}
                        onChange={(event) => updateProfile("emergencyPhone", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Country">
                      <input
                        value={settings.profile.country}
                        onChange={(event) => updateProfile("country", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="State">
                      <input
                        value={settings.profile.state}
                        onChange={(event) => updateProfile("state", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="City">
                      <input
                        value={settings.profile.city}
                        onChange={(event) => updateProfile("city", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Address" className="sm:col-span-2">
                      <textarea
                        rows={3}
                        value={settings.profile.address}
                        onChange={(event) => updateProfile("address", event.target.value)}
                        className="input-field resize-none"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-xl text-ink">Booking & Fees</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Booking Preference">
                      <select
                        value={settings.profile.bookingPreference}
                        onChange={(event) => updateProfile("bookingPreference", event.target.value)}
                        className="input-field"
                      >
                        <option value="Slot Based Booking">Slot Based Booking</option>
                        <option value="Request Approval Booking">Request Approval Booking</option>
                        <option value="Walk-in Queue Booking">Walk-in Queue Booking</option>
                      </select>
                    </Field>
                    <Field label="Appointment Slot Duration">
                      <input
                        type="number"
                        min="1"
                        value={settings.profile.appointmentSlotMinutes}
                        onChange={(event) => updateProfile("appointmentSlotMinutes", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Free Follow-up Period">
                      <input
                        type="number"
                        min="0"
                        value={settings.profile.freeFollowUpDays}
                        onChange={(event) => updateProfile("freeFollowUpDays", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                    <Field label="General Consultation Fee">
                      <input
                        type="number"
                        min="0"
                        value={settings.profile.consultationFee}
                        onChange={(event) => updateProfile("consultationFee", event.target.value)}
                        className="input-field"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">Working Hours</h2>
                    <Pill tone="neutral">Shown on public profile</Pill>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {settings.profile.workingHours.map((item, index) => (
                      <div key={item.day} className="grid grid-cols-1 gap-3 rounded-md border border-line bg-paper px-3 py-3 md:grid-cols-[130px_110px_1fr_1fr] md:items-center">
                        <p className="text-sm font-semibold text-ink">{item.day}</p>
                        <label className="flex items-center gap-2 text-sm text-ink-soft">
                          <input
                            type="checkbox"
                            checked={item.open}
                            onChange={(event) => updateWorkingHour(index, { open: event.target.checked })}
                            className="h-4 w-4 accent-brand-500"
                          />
                          Open
                        </label>
                        <TimePicker
                          value={item.startTime}
                          onChange={(value) => updateWorkingHour(index, { startTime: value })}
                          disabled={!item.open}
                          ariaLabel={`${item.day} start time`}
                        />
                        <TimePicker
                          value={item.endTime}
                          onChange={(value) => updateWorkingHour(index, { endTime: value })}
                          disabled={!item.open}
                          ariaLabel={`${item.day} end time`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">Treatments & Services</h2>
                    <button type="button" onClick={addTreatment} className="btn-secondary text-xs">
                      <Plus size={13} /> Add Service
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {settings.profile.treatments.map((item) => (
                      <div key={item.id} className="grid grid-cols-1 gap-3 rounded-md border border-line bg-paper px-3 py-3 sm:grid-cols-[1fr_140px_40px]">
                        <input
                          value={item.name}
                          onChange={(event) => updateTreatment(item.id, "name", event.target.value)}
                          placeholder="Treatment or service name"
                          className="input-field"
                        />
                        <input
                          value={item.fee}
                          onChange={(event) => updateTreatment(item.id, "fee", event.target.value)}
                          type="number"
                          min="0"
                          placeholder="INR"
                          className="input-field"
                        />
                        <button
                          type="button"
                          onClick={() => removeTreatment(item.id)}
                          className="btn-secondary h-10 px-0"
                          aria-label="Remove service"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">Profile Tags</h2>
                    <button type="button" onClick={addTag} className="btn-secondary text-xs">
                      <Plus size={13} /> Add Tag
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {settings.profile.profileTags.map((tag, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={tag}
                          onChange={(event) => updateTag(index, event.target.value)}
                          placeholder="lung doctor near me"
                          className="input-field"
                        />
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="btn-secondary px-3"
                          aria-label="Remove profile tag"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <Field label="About">
                  <textarea
                    rows={4}
                    value={settings.profile.about}
                    onChange={(event) => updateProfile("about", event.target.value)}
                    placeholder="Detailed public introduction, expertise, and care philosophy..."
                    className="input-field resize-none"
                  />
                </Field>
              </div>
            )}

            {tab === "My Workplaces" && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl text-ink">My Workplaces</h2>
                  <p className="mt-1 text-sm text-ink-muted">Clinic, hospital and online affiliations available in the doctor workspace menu.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {workplaces.map((workplace) => {
                    const Icon =
                      workplace.type === "hospital"
                        ? Hospital
                        : workplace.type === "online"
                          ? MonitorSmartphone
                          : Building2;
                    return (
                      <div key={workplace.id} className="rounded-card border border-line bg-paper p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-brand-700">
                              <Icon size={18} />
                            </span>
                            <div>
                              <h3 className="text-sm font-semibold text-ink">{workplace.name}</h3>
                              <p className="mt-1 text-xs text-ink-muted">{workplace.role ?? "Doctor"}</p>
                              <div className="mt-2">
                                <WorkplaceBadge workplace={workplace} />
                              </div>
                            </div>
                          </div>
                          <Pill tone={workplace.status === "Pending" ? "clay" : "sage"}>{workplace.status}</Pill>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-ink-muted sm:grid-cols-2">
                          <p>Type: {workplace.type}</p>
                          <p>Managed by: {workplace.managedBy ?? "Self"}</p>
                          <p>Location: {workplace.location ?? "Online"}</p>
                          <p>Department: {workplace.department ?? "-"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-ink-muted">
                  Workplaces are synced from your clinic records.
                </div>
              </div>
            )}

            {tab === "Consultation Preferences" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-ink-muted block mb-1">Default Consultation Length</label>
                    <select
                      className="input-field"
                      value={settings.consultationLength}
                      onChange={(event) => setSettings((prev) => ({ ...prev, consultationLength: event.target.value }))}
                    >
                      <option value="10">10 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="20">20 minutes</option>
                      <option value="30">30 minutes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-muted block mb-1">Buffer Between Appointments</label>
                    <select
                      className="input-field"
                      value={settings.bufferMinutes}
                      onChange={(event) => setSettings((prev) => ({ ...prev, bufferMinutes: event.target.value }))}
                    >
                      <option value="0">No buffer</option>
                      <option value="5">5 minutes</option>
                      <option value="10">10 minutes</option>
                    </select>
                  </div>
                </div>
                {preferenceLabels.map((label) => (
                  <label key={label} className="flex items-center gap-2.5 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={settings.preferences[label]}
                      onChange={(event) => updatePreference(label, event.target.checked)}
                      className="w-4 h-4 accent-brand-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {tab === "Notifications" && (
              <div className="space-y-3">
                {notificationLabels.map((label) => (
                  <div key={label} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0">
                    <span className="text-sm text-ink-soft">{label}</span>
                    <div className="flex gap-4 text-xs text-ink-muted">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={settings.notifications[label].inApp}
                          onChange={(event) => updateNotification(label, "inApp", event.target.checked)}
                          className="accent-brand-500"
                        />{" "}
                        In-app
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={settings.notifications[label].whatsapp}
                          onChange={(event) => updateNotification(label, "whatsapp", event.target.checked)}
                          className="accent-brand-500"
                        />{" "}
                        WhatsApp
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "Security" && (
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] text-ink-muted block mb-1">Current Password</label>
                  <input type="password" placeholder="********" className="input-field max-w-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted block mb-1">New Password</label>
                  <input type="password" placeholder="********" className="input-field max-w-sm" />
                </div>
                <label className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={settings.twoFactorEnabled}
                    onChange={(event) => setSettings((prev) => ({ ...prev, twoFactorEnabled: event.target.checked }))}
                    className="w-4 h-4 accent-brand-500"
                  />
                  Enable two-factor authentication
                </label>
              </div>
            )}

            <div className="pt-5 mt-5 border-t border-line">
              <button onClick={save} className="btn-primary">
                Save Changes
              </button>
              {saved && <span className="text-xs text-sage-500 ml-3">{syncMessage || "Saved"}</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
