"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Calendar,
  CreditCard,
  Bell,
  Shield,
  Database,
  Crown,
  User,
  Layers,
  Settings as SettingsIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/hospital-admin/components/ui/tabs";
import { PageHeader } from "@/hospital-admin/components/shared/page-header";
import { HospitalSettingsTab } from "@/hospital-admin/components/settings/HospitalSettingsTab";
import { DepartmentsSettingsTab } from "@/hospital-admin/components/settings/DepartmentsSettingsTab";
import { AppointmentSettingsTab } from "@/hospital-admin/components/settings/AppointmentSettingsTab";
import { BillingSettingsTab } from "@/hospital-admin/components/settings/BillingSettingsTab";
import { NotificationSettingsTab } from "@/hospital-admin/components/settings/NotificationSettingsTab";
import { SecuritySettingsTab } from "@/hospital-admin/components/settings/SecuritySettingsTab";
import { DataPrivacySettingsTab } from "@/hospital-admin/components/settings/DataPrivacySettingsTab";
import { SubscriptionSettingsTab } from "@/hospital-admin/components/settings/SubscriptionSettingsTab";
import { AccountSettingsTab } from "@/hospital-admin/components/settings/AccountSettingsTab";

const tabList = [
  { id: "hospital", label: "Hospital Settings", icon: Building2 },
  { id: "departments", label: "Departments", icon: Layers },
  { id: "appointments", label: "Appointment Settings", icon: Calendar },
  { id: "billing", label: "Billing Settings", icon: CreditCard },
  { id: "notifications", label: "Notification Settings", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "data-privacy", label: "Data & Privacy", icon: Database },
  { id: "subscription", label: "Subscription", icon: Crown },
  { id: "account", label: "Account Settings", icon: User },
];

const tabIds = tabList.map((tab) => tab.id);
const defaultTab = "hospital";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab && tabIds.includes(queryTab)) {
      setActiveTab(queryTab);
      return;
    }

    setActiveTab(defaultTab);
  }, [searchParams]);

  useEffect(() => {
    const syncTabFromHash = () => {
      const hashTab = window.location.hash.replace("#", "");
      if (tabIds.includes(hashTab)) setActiveTab(hashTab);
    };

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <PageHeader
        title="Settings & System Configuration"
        description="Comprehensive control center for hospital profile, departments, appointments, billing policies, security, data privacy, subscriptions, and account credentials."
        crumbs={[{ label: "Administration" }, { label: "Settings" }]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="rounded-xl border border-border bg-card p-1.5 shadow-xs overflow-x-auto scrollbar-none">
          <TabsList className="flex h-auto w-max sm:w-full items-center justify-start sm:justify-between gap-1 bg-transparent p-0">
            {tabList.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* 1. Hospital Settings */}
        <TabsContent value="hospital" className="focus-visible:outline-none space-y-4">
          <HospitalSettingsTab />
        </TabsContent>

        {/* 2. Departments */}
        <TabsContent value="departments" className="focus-visible:outline-none space-y-4">
          <DepartmentsSettingsTab />
        </TabsContent>

        {/* 3. Appointment Settings */}
        <TabsContent value="appointments" className="focus-visible:outline-none space-y-4">
          <AppointmentSettingsTab />
        </TabsContent>

        {/* 4. Billing Settings */}
        <TabsContent value="billing" className="focus-visible:outline-none space-y-4">
          <BillingSettingsTab />
        </TabsContent>

        {/* 5. Notification Settings */}
        <TabsContent value="notifications" className="focus-visible:outline-none space-y-4">
          <NotificationSettingsTab />
        </TabsContent>

        {/* 6. Security */}
        <TabsContent value="security" className="focus-visible:outline-none space-y-4">
          <SecuritySettingsTab />
        </TabsContent>

        {/* 7. Data & Privacy */}
        <TabsContent value="data-privacy" className="focus-visible:outline-none space-y-4">
          <DataPrivacySettingsTab />
        </TabsContent>

        {/* 8. Subscription */}
        <TabsContent value="subscription" className="focus-visible:outline-none space-y-4">
          <SubscriptionSettingsTab />
        </TabsContent>

        {/* 9. Account Settings */}
        <TabsContent value="account" className="focus-visible:outline-none space-y-4">
          <AccountSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
