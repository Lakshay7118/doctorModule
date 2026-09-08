"use client";

import { useState } from "react";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { CommandPalette } from "./CommandPalette";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDemo, useCurrentRole } from "@/state/demo-context";
import { MOCK_USERS } from "@/data/mock/integrations";

export function Topbar() {
  const { setMobileNavOpen } = useDemo();
  const role = useCurrentRole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentUser = MOCK_USERS.find((u) => u.roleId === role.id) ?? MOCK_USERS[0];
  const unreadCount = 5;

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b border-app-border bg-app-surface/95 px-3 backdrop-blur sm:px-6">
      <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-app-bg lg:hidden"><Menu className="h-5 w-5" /></button>
      <div className="hidden min-w-[150px] lg:block"><Breadcrumbs /></div>

      <button type="button" onClick={() => setPaletteOpen(true)} className="mx-auto hidden w-full max-w-[440px] items-center gap-2 rounded-control border border-app-border bg-white px-3 py-2.5 text-xs text-text-muted hover:border-brand-blue/30 md:flex" aria-label="Open laboratory search">
        <Search className="h-4 w-4" /> Search patients, orders, specimens...
        <kbd className="ml-auto rounded border border-app-border bg-app-bg px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Open laboratory search" className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-app-bg md:hidden"><Search className="h-5 w-5" /></button>

      <QuickCreateMenu />

      <Dropdown label="Notifications" align="right" trigger={({ toggle }) => (
        <button type="button" onClick={toggle} aria-label={`${unreadCount} unread notifications`} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-app-border text-text-muted hover:bg-app-bg">
          <Bell className="h-4 w-4" /><span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-semibold text-white">{unreadCount}</span>
        </button>
      )}>
        {() => <div className="w-72 space-y-1"><p className="px-2 pb-1 text-xs font-semibold text-text-main">Laboratory notifications</p>{["Critical result awaiting acknowledgement", "QC out-of-control — Glucose L2", "HMS charge posting requires review", "Manifest delayed on Thane route", "TSH cartridge near expiry"].map((item) => <div key={item} className="rounded-lg px-2.5 py-2 text-xs text-text-muted hover:bg-app-bg">{item}</div>)}</div>}
      </Dropdown>

      <button type="button" className="flex items-center gap-2 rounded-lg pl-1 text-left hover:opacity-80">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-blue">{currentUser.initials}</span>
        <span className="hidden leading-tight md:block"><span className="block text-xs font-semibold text-text-main">{currentUser.name}</span><span className="block text-[10px] text-text-muted">{role.label}</span></span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-text-muted md:block" />
      </button>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
