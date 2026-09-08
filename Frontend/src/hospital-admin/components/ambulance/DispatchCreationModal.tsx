"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  Building2,
  CheckCircle2,
  Lock,
  MapPin,
  Radio,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/hospital-admin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/hospital-admin/components/ui/dialog";
import { Label } from "@/hospital-admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/hospital-admin/components/ui/select";
import { Input } from "@/hospital-admin/components/ui/input";
import { Switch } from "@/hospital-admin/components/ui/switch";
import { Badge } from "@/hospital-admin/components/ui/badge";
import { AppDispatch, RootState } from "@/hospital-admin/store/store";
import { dispatchAmbulance, hydrateAmbulanceState } from "@/hospital-admin/store/slices/ambulanceSlice";
import { linkAmbulanceToCase } from "@/hospital-admin/store/slices/emergencySlice";
import { useToast } from "@/hospital-admin/hooks/use-toast";
import { createBackendDispatch, getBackendAmbulanceState, getHmsAuthSession } from "@/hospital-admin/lib/hms-api";

const DELEGATION_STRING = "Performed by Hospital Admin • acting within Ambulance Dispatch workflow";

export const RECEIVING_HOSPITALS = [
  { id: "qlyno-main", name: "Qlyno Main Multispecialty Hospital", type: "Primary Facility", status: "Open / ICU Ready" },
  { id: "city-general", name: "City General Emergency Trauma Center", type: "Configured Receiving Hospital", status: "Level 1 Trauma Open" },
  { id: "apex-trauma", name: "Apex Trauma Institute", type: "Configured Receiving Hospital", status: "Cardiac ICU Ready" },
  { id: "lilavati-er", name: "Lilavati Emergency & Critical Care", type: "Configured Receiving Hospital", status: "Open" },
];

interface DispatchCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId?: string; // Optional: if triggered from an emergency case (Module 08)
}

export function DispatchCreationModal({ open, onOpenChange, caseId }: DispatchCreationModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  const ambulances = useSelector((state: RootState) => state.ambulance.fleet);
  const emergencyCases = useSelector((state: RootState) => state.emergency.cases);
  
  const linkedCase = emergencyCases.find((c) => c.id === caseId);

  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId || "standalone");
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>("");
  const [destination, setDestination] = useState<string>(RECEIVING_HOSPITALS[0].name);
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("");
  const [isPatientLinked, setIsPatientLinked] = useState<boolean>(true); // Rule CANNOT #1 Permission Check
  const [priority, setPriority] = useState<"Critical - Code Red" | "Urgent - Code Yellow" | "Standard Transport">("Critical - Code Red");
  const [notes, setNotes] = useState<string>("");

  // Sync state when opened with caseId
  useEffect(() => {
    if (caseId && linkedCase) {
      setSelectedCaseId(caseId);
      setPickupAddress(linkedCase.location || "");
      setPatientName(linkedCase.patientName || "");
      if (linkedCase.destinationHospital) {
        setDestination(linkedCase.destinationHospital);
      }
    } else if (!caseId) {
      setSelectedCaseId("standalone");
      setPickupAddress("");
      setPatientName("");
    }
  }, [caseId, linkedCase, open]);

  // Strict Rule CANNOT #3 & #4: Filter for ONLY eligible, available ambulances
  const availableAmbulances = ambulances.filter((a) => a.status === "Available");
  const nonAvailableCount = ambulances.filter((a) => a.status !== "Available").length;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmbulanceId || !destination) return;

    const chosenAmb = ambulances.find((a) => a.id === selectedAmbulanceId);
    if (!chosenAmb || chosenAmb.status !== "Available") {
      toast({
        title: "Dispatch Blocked",
        description: "Selected ambulance is no longer available or under maintenance. (Rule CANNOT #3)",
        variant: "destructive",
      });
      return;
    }

    const effectiveCaseId = selectedCaseId !== "standalone" ? selectedCaseId : undefined;

    const dispatchPayload = {
      ambulanceId: selectedAmbulanceId,
      caseId: effectiveCaseId,
      patientName: isPatientLinked ? patientName : undefined,
      isPatientLinked: isPatientLinked,
      originAddress: pickupAddress || chosenAmb.baseLocation,
      destinationHospital: destination,
      priority: priority,
      notes: notes,
    };

    if (getHmsAuthSession()) {
      try {
        await createBackendDispatch(dispatchPayload);
        const backendState = await getBackendAmbulanceState();
        dispatch(hydrateAmbulanceState({ fleet: backendState.fleet, dispatchHistory: backendState.dispatchHistory }));
      } catch (error) {
        toast({
          title: "Backend Dispatch Failed",
          description: error instanceof Error ? error.message : "Ambulance dispatch could not be saved.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // 1. Dispatch in Ambulance Redux State
      dispatch(dispatchAmbulance(dispatchPayload));
    }

    // 2. Sync to Emergency Case if linked (Module 08 Integration)
    if (effectiveCaseId) {
      dispatch(
        linkAmbulanceToCase({
          caseId: effectiveCaseId,
          ambulanceId: selectedAmbulanceId,
          actor: "Hospital Admin",
        })
      );
    }

    // 3. Broadcast Simulated Notifications (PRD Notifications Section)
    toast({
      title: "Ambulance Dispatched Successfully",
      description: `Vehicle ${chosenAmb.vehicleNo} dispatched to ${destination}. Broadcast sent to Emergency Trauma Team & Driver Handset (${chosenAmb.driver?.name || "On-duty Driver"}). • ${DELEGATION_STRING}`,
    });

    // Reset & Close
    setSelectedAmbulanceId("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleDispatch}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AmbulanceIcon className="h-5 w-5 text-primary" />
              <span>Create Ambulance Dispatch</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {caseId
                ? `Assign an active ambulance resource for Emergency Case ${caseId}.`
                : "Initiate an operational ambulance transport dispatch with patient privacy guardrails."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3 text-xs">
            {/* Emergency Case Selector (Standalone vs Linked) */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Dispatch Context / Case Link</Label>
              <Select value={selectedCaseId} onValueChange={(val) => {
                setSelectedCaseId(val);
                if (val !== "standalone") {
                  const c = emergencyCases.find(item => item.id === val);
                  if (c) {
                    setPickupAddress(c.location || "");
                    setPatientName(c.patientName || "");
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select context..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone Dispatch (Hospital Transfer / Direct Request)</SelectItem>
                  {emergencyCases
                    .filter((c) => c.status !== "Closed")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.id} — {c.priority} Priority ({c.patientName} • {c.location})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Selection (Strict Rule CANNOT #3 & #4) */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Available Ambulance <span className="text-destructive">*</span></Label>
                <span className="text-[11px] text-muted-foreground">
                  {availableAmbulances.length} available ({nonAvailableCount} offline/dispatched)
                </span>
              </div>
              <Select value={selectedAmbulanceId} onValueChange={setSelectedAmbulanceId} required>
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Choose an available vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAmbulances.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No ambulances currently in Available status
                    </SelectItem>
                  ) : (
                    availableAmbulances.map((amb) => (
                      <SelectItem key={amb.id} value={amb.id}>
                        <span className="font-semibold text-foreground">{amb.vehicleNo}</span> ({amb.type}) — Base: {amb.baseLocation} • Driver: {amb.driver?.name || "Assigned"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {availableAmbulances.length === 0 && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> All units are currently dispatched or under maintenance. Check Status Board to free a vehicle.
                </p>
              )}
            </div>

            {/* Destination Hospital Selection (Rule CAN #17) */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Destination / Receiving Hospital <span className="text-destructive">*</span></Label>
              <Select value={destination} onValueChange={setDestination} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVING_HOSPITALS.map((h) => (
                    <SelectItem key={h.id} value={h.name}>
                      <span className="font-medium text-foreground">{h.name}</span> — <span className="text-muted-foreground text-[11px]">{h.status}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pickup / Origin Address */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Pickup Location / Incident Scene</Label>
              <div className="relative">
                <MapPin className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  className="pl-9 text-xs"
                  placeholder="e.g. Bandra West, S.V. Road, Mumbai"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Patient Linking Permission Check (Rule CANNOT #1 & CAN #14) */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="patient-link-toggle" className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    <span>Link Patient Identity (Permission Required)</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Per Rule CANNOT #1, uncheck to dispatch with an anonymized trauma token.
                  </p>
                </div>
                <Switch
                  id="patient-link-toggle"
                  checked={isPatientLinked}
                  onCheckedChange={setIsPatientLinked}
                />
              </div>

              {isPatientLinked ? (
                <div className="pt-2 border-t border-border/60">
                  <Label className="text-[11px] text-muted-foreground">Patient Full Name</Label>
                  <Input
                    className="mt-1 h-8 text-xs bg-background"
                    placeholder="e.g. Aarav Shah"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="pt-1 text-[11px] text-warning flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Anonymous Dispatch Manifest • Patient identity masked in transport ledger</span>
                </div>
              )}
            </div>

            {/* Priority & Dispatch Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Triage Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical - Code Red">Critical - Code Red (Lights & Siren)</SelectItem>
                    <SelectItem value="Urgent - Code Yellow">Urgent - Code Yellow</SelectItem>
                    <SelectItem value="Standard Transport">Standard Transport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Handover / Clinical Notes</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Suspected stroke, Oxygen support needed"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Notification Broadcast Notice */}
            <div className="p-2.5 rounded-lg bg-info/10 border border-info/20 text-info text-[11px] flex items-start gap-2">
              <Radio className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Dispatch broadcast will automatically notify the receiving Emergency Triage Desk, on-duty Driver handset, and Emergency trauma coordinator.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedAmbulanceId || !destination || availableAmbulances.length === 0}>
              <AmbulanceIcon className="mr-2 h-4 w-4" />
              Confirm & Dispatch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
