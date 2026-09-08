"use client";

const portalStyles = `
      .rp-root {
        --rp-ink: rgb(var(--qlyno-ink));
        --rp-paper: rgb(var(--qlyno-paper));
        --rp-panel: rgb(var(--qlyno-surface));
        --rp-line: rgb(var(--qlyno-line));
        --rp-pine: rgb(var(--qlyno-brand-600));
        --rp-pine-dark: rgb(var(--qlyno-brand-800));
        --rp-pine-soft: rgb(var(--qlyno-brand-50));
        --rp-coral: rgb(var(--qlyno-alert-500));
        --rp-coral-soft: rgb(var(--qlyno-alert-50));
        --rp-amber: rgb(var(--qlyno-warning-500));
        --rp-amber-soft: rgb(var(--qlyno-warning-50));
        --rp-slate: rgb(var(--qlyno-ink-500));
        --rp-slate-soft: rgb(var(--qlyno-ink-50));
        font-family: var(--font-sans);
        background: var(--rp-paper);
        color: var(--rp-ink);
        min-height: 100vh;
      }

      .rp-root h1, .rp-root h2, .rp-root h3, .rp-h1, .rp-h2, .rp-h3, .rp-logo, .rp-stat-value {
        font-family: var(--font-sans);
      }

      .rp-mono, .rp-ticker-chip span:first-child {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
      }

      /* ---- Layout shell ---- */
      .rp-shell { display: flex; min-height: 100vh; }

      .rp-sidebar {
        width: 280px;
        flex-shrink: 0;
        background: rgb(var(--qlyno-surface) / 0.92);
        color: var(--rp-ink);
        display: flex;
        flex-direction: column;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
        border-right: 1px solid var(--rp-line);
        backdrop-filter: blur(12px);
      }
      .rp-sidebar-header { padding: 18px 20px 14px; border-bottom: 1px solid var(--rp-line); }
      .rp-logo { font-size: 20px; font-weight: 600; letter-spacing: 0; color: var(--rp-ink); line-height: 1; }
      .rp-logo-sub { font-size: 10px; color: var(--rp-slate); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
      .rp-nav { padding: 12px; flex: 1; }
      .rp-nav-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; text-align: left;
        padding: 9px 11px; border-radius: 8px;
        font-size: 13px; font-weight: 500;
        color: var(--rp-ink);
        background: transparent; border: none; cursor: pointer;
        margin-bottom: 2px;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .rp-nav-item:hover { background: var(--rp-pine-soft); color: var(--rp-pine-dark); }
      .rp-nav-item.active { background: var(--rp-pine-soft); color: var(--rp-pine-dark); border-left: 4px solid var(--rp-pine); box-shadow: 0 1px 2px rgb(var(--qlyno-ink-900) / 0.04); }
      .rp-nav-number { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; opacity: 0.55; width: 16px; flex-shrink: 0; }
      .rp-sidebar-footer { padding: 14px 20px; border-top: 1px solid var(--rp-line); font-size: 11.5px; color: var(--rp-slate); }

      .rp-main { flex: 1; min-width: 0; }
      .rp-topbar {
        position: sticky; top: 0; z-index: 30;
        display: flex; align-items: center; gap: 12px;
        min-height: 64px;
        padding: 12px 28px;
        background: rgb(var(--qlyno-surface) / 0.95);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--rp-line);
      }
      .rp-topbar-search {
        flex: 1; max-width: 420px; position: relative;
      }
      .rp-content { padding: 28px 32px 60px; max-width: 1440px; margin: 0 auto; }

      /* ---- Typography ---- */
      .rp-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rp-slate); }
      .rp-h1 { font-size: 24px; font-weight: 600; margin-top: 4px; letter-spacing: 0; }
      .rp-h2 { font-family: var(--font-sans); font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--rp-ink); }
      .rp-h3 { font-size: 12.5px; font-weight: 600; color: var(--rp-slate); text-transform: uppercase; letter-spacing: 0.04em; }
      .rp-sub { font-size: 13.5px; color: var(--rp-slate); margin-top: 4px; line-height: 1.5; }
      .rp-label { display: block; font-size: 12.5px; font-weight: 500; color: var(--rp-ink); margin-bottom: 6px; }
      .rp-hint { display: block; font-size: 11.5px; color: var(--rp-slate); margin-top: 4px; }

      /* ---- Card ---- */
      .rp-card {
        background: var(--rp-panel);
        border: 1px solid var(--rp-line);
        border-radius: 14px;
        padding: 20px;
      }
      .rp-card-alert { border-color: rgb(var(--qlyno-alert-100)); background: var(--rp-coral-soft); }
      .rp-card-success { border-color: rgb(var(--qlyno-success-100)); background: rgb(var(--qlyno-success-50)); }

      /* ---- Ticker (signature element) ---- */
      .rp-ticker { display: flex; align-items: center; gap: 18px; padding: 14px 20px; flex-wrap: wrap; }
      .rp-ticker-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--rp-pine); white-space: nowrap; }
      .rp-ticker-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .rp-ticker-chip {
        display: flex; align-items: center; gap: 7px;
        border-radius: 999px; padding: 5px 12px 5px 10px;
        font-size: 12px; border: 1px solid transparent;
      }
      .rp-ticker-chip span:first-child { font-weight: 600; }
      .rp-ticker-chip-pine { background: var(--rp-pine-soft); color: var(--rp-pine-dark); }
      .rp-ticker-chip-amber { background: var(--rp-amber-soft); color: var(--rp-amber); }
      .rp-ticker-chip-slate { background: var(--rp-slate-soft); color: var(--rp-slate); }
      .rp-ticker-chip-coral { background: var(--rp-coral-soft); color: var(--rp-coral); }

      /* ---- Grids ---- */
      .rp-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .rp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .rp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .rp-grid-2-wide { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; align-items: start; }
      @media (max-width: 920px) {
        .rp-grid-4 { grid-template-columns: repeat(2, 1fr); }
        .rp-grid-2-wide { grid-template-columns: 1fr; }
      }
      @media (max-width: 620px) {
        .rp-grid-2, .rp-grid-3, .rp-grid-4 { grid-template-columns: 1fr; }
      }

      /* ---- Stat card ---- */
      .rp-stat-value { font-size: 26px; font-weight: 700; margin-top: 10px; }
      .rp-stat-delta { font-size: 12px; color: var(--rp-slate); margin-top: 2px; }
      .rp-stat-icon { display: inline-flex; padding: 6px; border-radius: 8px; }
      .rp-stat-icon-pine { background: var(--rp-pine-soft); color: var(--rp-pine); }
      .rp-stat-icon-amber { background: var(--rp-amber-soft); color: var(--rp-amber); }
      .rp-stat-icon-coral { background: var(--rp-coral-soft); color: var(--rp-coral); }
      .rp-stat-icon-slate { background: var(--rp-slate-soft); color: var(--rp-slate); }
      .rp-stat-icon-line { background: var(--rp-slate-soft); color: var(--rp-slate); }

      /* ---- Badge ---- */
      .rp-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
      .rp-badge-pine { background: var(--rp-pine-soft); color: var(--rp-pine-dark); }
      .rp-badge-coral { background: var(--rp-coral-soft); color: var(--rp-coral); }
      .rp-badge-amber { background: var(--rp-amber-soft); color: var(--rp-amber); }
      .rp-badge-slate { background: var(--rp-slate-soft); color: var(--rp-slate); }
      .rp-badge-line { background: var(--rp-paper); color: var(--rp-slate); border: 1px solid var(--rp-line); }

      /* ---- Buttons ---- */
      .rp-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 9px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: filter 0.15s ease, background 0.15s ease; }
      .rp-btn-md { padding: 9px 16px; font-size: 13.5px; }
      .rp-btn-sm { padding: 6px 11px; font-size: 12.5px; }
      .rp-btn-primary { background: var(--rp-pine); color: rgb(var(--qlyno-surface)); }
      .rp-btn-primary:hover { background: var(--rp-pine-dark); }
      .rp-btn-secondary { background: var(--rp-pine-soft); color: var(--rp-pine-dark); }
      .rp-btn-secondary:hover { filter: brightness(0.97); }
      .rp-btn-ghost { background: transparent; color: var(--rp-ink); border-color: var(--rp-line); }
      .rp-btn-danger { background: var(--rp-coral); color: rgb(var(--qlyno-surface)); }
      .rp-btn-danger:hover { filter: brightness(0.95); }
      .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .rp-icon-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; border-radius: 7px;
        border: 1px solid var(--rp-line); background: var(--rp-panel); color: var(--rp-slate);
        cursor: pointer;
      }
      .rp-icon-btn:hover { background: var(--rp-pine-soft); color: var(--rp-pine-dark); border-color: transparent; }
      .rp-icon-btn-danger:hover { background: var(--rp-coral-soft); color: var(--rp-coral); }

      /* ---- Inputs ---- */
      .rp-input {
        width: 100%; border: 1px solid var(--rp-line); border-radius: 9px;
        padding: 9px 12px; font-size: 13.5px; background: var(--rp-panel); color: var(--rp-ink);
        outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .rp-input:focus { border-color: var(--rp-pine); box-shadow: 0 0 0 3px var(--rp-pine-soft); }
      .rp-input-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rp-slate); pointer-events: none; }

      /* ---- Table ---- */
      .rp-table-wrap { overflow-x: auto; }
      .rp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .rp-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rp-slate); padding: 8px 10px; border-bottom: 1px solid var(--rp-line); white-space: nowrap; }
      .rp-table td { padding: 10px; border-bottom: 1px solid var(--rp-line); color: var(--rp-ink); vertical-align: middle; white-space: nowrap; }
      .rp-table tr:last-child td { border-bottom: none; }
      .rp-table tr:hover td { background: var(--rp-paper); }

      /* ---- List rows (dashboard / queues) ---- */
      .rp-list { display: flex; flex-direction: column; gap: 2px; }
      .rp-list-row { display: flex; align-items: center; gap: 12px; padding: 9px 4px; border-bottom: 1px solid var(--rp-line); }
      .rp-list-row:last-child { border-bottom: none; }
      .rp-list-title { font-size: 13.5px; font-weight: 500; color: var(--rp-ink); }
      .rp-list-sub { font-size: 12px; color: var(--rp-slate); margin-top: 1px; }

      /* ---- Steps ---- */
      .rp-steps { list-style: none; counter-reset: rp-step; display: flex; flex-direction: column; gap: 10px; }
      .rp-steps li { counter-increment: rp-step; position: relative; padding-left: 28px; font-size: 13px; color: var(--rp-slate); line-height: 1.5; }
      .rp-steps li::before {
        content: counter(rp-step); position: absolute; left: 0; top: -1px;
        width: 19px; height: 19px; border-radius: 50%;
        background: var(--rp-pine-soft); color: var(--rp-pine-dark);
        font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 600;
        display: flex; align-items: center; justify-content: center;
      }

      /* ---- Empty state ---- */
      .rp-empty { text-align: center; padding: 40px 20px; }
      .rp-empty-mark { width: 34px; height: 34px; margin: 0 auto 14px; border-radius: 10px; border: 1.5px dashed var(--rp-line); }
      .rp-empty-title { font-size: 13.5px; font-weight: 600; color: var(--rp-ink); }
      .rp-empty-desc { font-size: 12.5px; color: var(--rp-slate); margin-top: 3px; }

      /* ---- UHID / token chip ---- */
      .rp-uhid-chip { display: inline-flex; align-items: center; gap: 8px; background: var(--rp-pine-soft); color: var(--rp-pine-dark); border-radius: 9px; padding: 8px 14px; font-size: 12.5px; }
      .rp-uhid-chip span:first-child { font-weight: 500; opacity: 0.75; }

      /* ---- Toggle rows (settings) ---- */
      .rp-toggle-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--rp-ink); padding: 6px 0; }
      .rp-toggle { width: 34px; height: 20px; accent-color: var(--rp-pine); cursor: pointer; }

      /* ---- Quick actions grid ---- */
      .rp-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      @media (max-width: 760px) { .rp-quick-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 480px) { .rp-quick-grid { grid-template-columns: 1fr; } }
      .rp-quick-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
        background: var(--rp-panel); border: 1px solid var(--rp-line); border-radius: 8px;
        padding: 18px; text-align: left; cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
      }
      .rp-quick-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgb(var(--qlyno-ink-900) / 0.07); border-color: transparent; }
      .rp-quick-icon { display: inline-flex; padding: 9px; border-radius: 10px; }
      .rp-quick-icon-pine { background: var(--rp-pine-soft); color: var(--rp-pine-dark); }
      .rp-quick-icon-coral { background: var(--rp-coral-soft); color: var(--rp-coral); }
      .rp-quick-label { font-family: var(--font-sans); font-size: 15px; font-weight: 700; }
      .rp-quick-desc { font-size: 12px; color: var(--rp-slate); line-height: 1.4; }

      /* ---- Mobile sidebar ---- */
      .rp-sidebar-toggle { display: none; }
      @media (max-width: 880px) {
        .rp-sidebar { position: fixed; z-index: 40; transform: translateX(-100%); transition: transform 0.2s ease; }
        .rp-sidebar.open { transform: translateX(0); }
        .rp-sidebar-toggle { display: inline-flex; }
        .rp-content { padding: 20px 16px 60px; }
        .rp-topbar { padding: 12px 16px; }
      }
    `;

export function PortalStyles() {
  return <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: portalStyles }} />;
}
