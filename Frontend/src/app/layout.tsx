import type { Metadata, Viewport } from "next";
import { getThemeStyle } from "@/config/theme";
import "@/styles/globals.css";
import { DemoProvider } from "@/state/demo-context";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";
import { HospitalWorkflowProvider } from "@/state/hospital-workflow-context";
import { ModeProvider } from "@/lib/mode-context";
import { DoctorWorkflowProvider } from "@/lib/doctor-workflow-context";

export const metadata: Metadata = {
  title: "Qlyno Unified Healthcare Portal",
  description: "Unified healthcare workspace for hospital, clinical, billing and laboratory modules.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={getThemeStyle()}>
      <body className="font-sans">
        <DemoProvider>
          <HospitalWorkflowProvider>
            <ToastProvider>
              <ModeProvider>
                <DoctorWorkflowProvider>
                  <AppShell>{children}</AppShell>
                </DoctorWorkflowProvider>
              </ModeProvider>
            </ToastProvider>
          </HospitalWorkflowProvider>
        </DemoProvider>
      </body>
    </html>
  );
}
