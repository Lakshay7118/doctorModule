"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  CheckCircle2,
  Clock,
  Compass,
  Edit,
  Eye,
  Gauge,
  Kanban,
  LayoutList,
  MapPin,
  MoreHorizontal,
  Navigation,
  Pencil,
  Phone,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react";

import { Badge } from "@/hospital-admin/components/ui/badge";
import { Button } from "@/hospital-admin/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/hospital-admin/components/ui/card";
import { PageHeader } from "@/hospital-admin/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/hospital-admin/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/hospital-admin/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/hospital-admin/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/hospital-admin/components/ui/dialog";
import { Input } from "@/hospital-admin/components/ui/input";
import { Label } from "@/hospital-admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/hospital-admin/components/ui/select";
import { Textarea } from "@/hospital-admin/components/ui/textarea";
import { AppDispatch, RootState } from "@/hospital-admin/store/store";
import {
  Ambulance,
  AmbulanceStatus,
  AmbulanceType,
  CrewMember,
  assignDriverCrew,
  freeAmbulance,
  hydrateAmbulanceState,
  registerAmbulance,
  upsertAmbulance,
  updateAmbulanceRegistry,
  updateAmbulanceStatus,
} from "@/hospital-admin/store/slices/ambulanceSlice";
import { updateCaseStatus } from "@/hospital-admin/store/slices/emergencySlice";
import { DispatchCreationModal } from "@/hospital-admin/components/ambulance/DispatchCreationModal";
import { useToast } from "@/hospital-admin/hooks/use-toast";
import { STATUS_CONFIG } from "@/hospital-admin/lib/ambulance-status";
import {
  createBackendAmbulance,
  getBackendAmbulanceState,
  getHmsAuthSession,
  updateBackendAmbulance,
  updateBackendAmbulanceStatus,
} from "@/hospital-admin/lib/hms-api";

const DELEGATION_STRING = "Performed by Hospital Admin • acting within Ambulance Dispatch workflow";

const ALL_STATUSES: AmbulanceStatus[] = [
  "Available",
  "Dispatched",
  "En Route",
  "At Scene",
  "Transporting",
  "At Hospital",
  "Maintenance/Offline",
];

const STANDARD_EQUIPMENT = [
  "Defibrillator",
  "Transport Ventilator",
  "Oxygen Tank",
  "Cardiac Monitor",
  "Suction Unit",
  "Infusion Pump",
  "Spine Board",
  "First Aid Kit",
  "Neonatal Incubator",
];

export default function AmbulancePage() {
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  const ambulances = useSelector((state: RootState) => state.ambulance.fleet);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSyncingBackend, setIsSyncingBackend] = useState(false);

  const [activeTab, setActiveTab] = useState<"registry" | "kanban">("registry");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");

  // Modals
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingAmbulance, setEditingAmbulance] = useState<Ambulance | null>(null);
  const [crewModalAmb, setCrewModalAmb] = useState<Ambulance | null>(null);
  const [viewingAmbulance, setViewingAmbulance] = useState<Ambulance | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const openDetailsModal = (amb: Ambulance) => {
    setViewingAmbulance(amb);
    setShowDetailsModal(true);
  };

  // Form states for vehicle registration/edit
  const [vehicleNo, setVehicleNo] = useState("");
  const [vehicleType, setVehicleType] = useState<AmbulanceType>("ALS");
  const [baseLocation, setBaseLocation] = useState("Qlyno Main Campus");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  // Form states for driver & crew
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverShift, setDriverShift] = useState("Day Shift (08:00 - 16:00)");
  const [crewList, setCrewList] = useState<CrewMember[]>([]);

  const refreshBackendState = useCallback(async () => {
    const state = await getBackendAmbulanceState();
    dispatch(hydrateAmbulanceState({ fleet: state.fleet, dispatchHistory: state.dispatchHistory }));
    setIsBackendConnected(true);
  }, [dispatch]);

  useEffect(() => {
    if (!getHmsAuthSession()) return;
    setIsSyncingBackend(true);
    refreshBackendState()
      .catch((error) => {
        setIsBackendConnected(false);
        console.warn("Failed to load backend ambulance state:", error);
      })
      .finally(() => setIsSyncingBackend(false));
  }, [refreshBackendState]);

  // Derived counts for fleet overview
  const availableCount = ambulances.filter((a) => a.status === "Available").length;
  const activeDispatchesCount = ambulances.filter((a) =>
    ["Dispatched", "En Route", "At Scene", "Transporting", "At Hospital"].includes(a.status)
  ).length;
  const maintenanceCount = ambulances.filter((a) => a.status === "Maintenance/Offline").length;

  // Filtered list
  const filteredAmbulances = useMemo(() => {
    return ambulances.filter((a) => {
      const matchSearch =
        a.vehicleNo.toLowerCase().includes(search.toLowerCase()) ||
        a.driver?.name.toLowerCase().includes(search.toLowerCase()) ||
        a.driverName?.toLowerCase().includes(search.toLowerCase()) ||
        a.equipment.some((eq) => eq.toLowerCase().includes(search.toLowerCase()));

      const matchType = filterType === "All" || a.type === filterType;
      const matchStatus = filterStatus === "All" || a.status === filterStatus;
      const matchLocation = filterLocation === "All" || a.baseLocation === filterLocation;

      return matchSearch && matchType && matchStatus && matchLocation;
    });
  }, [ambulances, search, filterType, filterStatus, filterLocation]);

  // Handlers for Status Transitions (Rules CAN #6-12)
  const handleStatusChange = async (amb: Ambulance, newStatus: AmbulanceStatus) => {
    if (isBackendConnected) {
      try {
        setIsSyncingBackend(true);
        await updateBackendAmbulanceStatus(
          amb.id,
          newStatus,
          newStatus === "Maintenance/Offline" ? amb.maintenanceNotes || "Marked offline from hospital admin" : undefined
        );
        await refreshBackendState();
      } catch (error) {
        toast({
          title: "Backend Update Failed",
          description: error instanceof Error ? error.message : "Ambulance status could not be saved.",
          variant: "destructive",
        });
        return;
      } finally {
        setIsSyncingBackend(false);
      }
    } else {
      if (newStatus === "Available") {
        dispatch(freeAmbulance(amb.id));
      } else {
        dispatch(updateAmbulanceStatus({ id: amb.id, status: newStatus }));
      }
    }

    // Auto-sync status to Emergency Case if linked (Module 08 Sync)
    if (amb.currentCaseId) {
      let emergencyStatus: any = undefined;
      if (newStatus === "En Route") emergencyStatus = "Ambulance Dispatched";
      if (newStatus === "At Hospital") emergencyStatus = "Arrived";
      if (newStatus === "Available") emergencyStatus = "Resolved";

      if (emergencyStatus) {
        dispatch(
          updateCaseStatus({
            id: amb.currentCaseId,
            status: emergencyStatus,
            actor: `Hospital Admin (Ambulance Update: ${newStatus})`,
          })
        );
      }
    }

    toast({
      title: "Ambulance Status Updated",
      description: `Vehicle ${amb.vehicleNo} transitioned to "${newStatus}". • ${DELEGATION_STRING}`,
    });
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingAmbulance(null);
    setVehicleNo("");
    setVehicleType("ALS");
    setBaseLocation("Qlyno Main Campus");
    setSelectedEquipment(["Defibrillator", "Oxygen Tank", "Transport Ventilator"]);
    setMaintenanceNotes("");
    setShowVehicleModal(true);
  };

  // Open Edit Modal
  const openEditModal = (amb: Ambulance) => {
    setEditingAmbulance(amb);
    setVehicleNo(amb.vehicleNo);
    setVehicleType(amb.type);
    setBaseLocation(amb.baseLocation);
    setSelectedEquipment(amb.equipment);
    setMaintenanceNotes(amb.maintenanceNotes || "");
    setShowVehicleModal(true);
  };

  // Handle Save Vehicle (Register or Edit)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) return;

    if (editingAmbulance) {
      const nextAmbulance: Ambulance = {
        ...editingAmbulance,
        vehicleNo: vehicleNo.trim(),
        type: vehicleType,
        equipment: selectedEquipment,
        baseLocation: baseLocation,
        maintenanceNotes: maintenanceNotes.trim() || undefined,
      };

      if (isBackendConnected) {
        try {
          setIsSyncingBackend(true);
          dispatch(upsertAmbulance(await updateBackendAmbulance(nextAmbulance)));
        } catch (error) {
          toast({
            title: "Backend Save Failed",
            description: error instanceof Error ? error.message : "Vehicle changes could not be saved.",
            variant: "destructive",
          });
          return;
        } finally {
          setIsSyncingBackend(false);
        }
      } else {
        dispatch(
          updateAmbulanceRegistry({
            id: editingAmbulance.id,
            vehicleNo: vehicleNo.trim(),
            type: vehicleType,
            equipment: selectedEquipment,
            baseLocation: baseLocation,
            maintenanceNotes: maintenanceNotes.trim() || undefined,
          })
        );
      }
      toast({
        title: "Ambulance Registry Updated",
        description: `Configuration updated for ${vehicleNo}. • ${DELEGATION_STRING}`,
      });
    } else {
      if (isBackendConnected) {
        try {
          setIsSyncingBackend(true);
          dispatch(
            upsertAmbulance(
              await createBackendAmbulance({
                vehicleNo: vehicleNo.trim(),
                type: vehicleType,
                equipment: selectedEquipment,
                baseLocation: baseLocation,
                maintenanceNotes: maintenanceNotes.trim() || undefined,
              })
            )
          );
        } catch (error) {
          toast({
            title: "Backend Save Failed",
            description: error instanceof Error ? error.message : "Vehicle could not be registered.",
            variant: "destructive",
          });
          return;
        } finally {
          setIsSyncingBackend(false);
        }
      } else {
        dispatch(
          registerAmbulance({
            vehicleNo: vehicleNo.trim(),
            type: vehicleType,
            equipment: selectedEquipment,
            baseLocation: baseLocation,
            maintenanceNotes: maintenanceNotes.trim() || undefined,
          })
        );
      }
      toast({
        title: "New Ambulance Registered",
        description: `Vehicle ${vehicleNo} added to hospital fleet. • ${DELEGATION_STRING}`,
      });
    }

    setShowVehicleModal(false);
  };

  // Open Crew Modal
  const openCrewModal = (amb: Ambulance) => {
    setCrewModalAmb(amb);
    setDriverName(amb.driver?.name || amb.driverName || "");
    setDriverPhone(amb.driver?.phone || "+91 98220 00000");
    setDriverLicense(amb.driver?.licenseNo || "DL-MH-2022-XXXX");
    setDriverShift(amb.driver?.shift || "Day Shift (08:00 - 16:00)");
    setCrewList(amb.crew && amb.crew.length > 0 ? [...amb.crew] : [{ name: "", role: "Paramedic", phone: "" }]);
  };

  // Handle Save Crew
  const handleSaveCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewModalAmb) return;

    const validCrew = crewList.filter((c) => c.name.trim().length > 0);
    const nextAmbulance: Ambulance = {
      ...crewModalAmb,
      driver: {
        name: driverName.trim(),
        phone: driverPhone.trim(),
        licenseNo: driverLicense.trim(),
        shift: driverShift,
      },
      driverName: driverName.trim(),
      crew: validCrew,
    };

    if (isBackendConnected) {
      try {
        setIsSyncingBackend(true);
        dispatch(upsertAmbulance(await updateBackendAmbulance(nextAmbulance)));
      } catch (error) {
        toast({
          title: "Backend Save Failed",
          description: error instanceof Error ? error.message : "Driver and crew changes could not be saved.",
          variant: "destructive",
        });
        return;
      } finally {
        setIsSyncingBackend(false);
      }
    } else {
      dispatch(
        assignDriverCrew({
          ambulanceId: crewModalAmb.id,
          driver: nextAmbulance.driver!,
          crew: validCrew,
        })
      );
    }

    toast({
      title: "Driver & Crew Assignment Saved",
      description: `Personnel assigned to ${crewModalAmb.vehicleNo} per hospital policy. • ${DELEGATION_STRING}`,
    });

    setCrewModalAmb(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Ambulance Dispatch & Fleet Management"
        description="Hospital transport availability, 7-state lifecycle tracking, driver/crew deployment, and emergency dispatch coordination."
        crumbs={[{ label: "Hospital Operations" }, { label: "Ambulance Management" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9"
              disabled={isSyncingBackend || !getHmsAuthSession()}
              onClick={() => {
                setIsSyncingBackend(true);
                refreshBackendState()
                  .then(() => toast({ title: "Backend Fleet Synced", description: "Latest ambulance registry and dispatch history loaded." }))
                  .catch((error) =>
                    toast({
                      title: "Backend Sync Failed",
                      description: error instanceof Error ? error.message : "Could not load ambulance records.",
                      variant: "destructive",
                    })
                  )
                  .finally(() => setIsSyncingBackend(false));
              }}
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${isSyncingBackend ? "animate-spin" : ""}`} />
              <span>{isBackendConnected ? "Backend Synced" : "Sync Backend"}</span>
            </Button>
            <Link href="/hospital-admin/ambulance/live-tracking">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Live GPS Map</span>
              </Button>
            </Link>
            <Link href="/hospital-admin/ambulance/history">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <span>Dispatch History</span>
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5 h-9 font-semibold" onClick={() => setShowDispatchModal(true)}>
              <Play className="h-4 w-4" />
              <span>Create Dispatch</span>
            </Button>
          </div>
        }
      />

      {/* Fleet Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Total Fleet Units</span>
            <p className="text-xl font-bold text-foreground mt-0.5">{ambulances.length}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <AmbulanceIcon className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Available for Dispatch</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{availableCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5 p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Active In Transit / Scene</span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{activeDispatchesCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <Radio className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-slate-500/20 bg-slate-500/5 p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Maintenance / Offline</span>
            <p className="text-xl font-bold text-slate-600 dark:text-slate-400 mt-0.5">{maintenanceCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-slate-500/10 text-slate-600 flex items-center justify-center font-bold">
            <Wrench className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Hub: Table Registry vs. Availability Kanban Board */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {/* Top Controls: View Switcher & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-border">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === "registry" ? "default" : "outline"}
              className="gap-1.5 h-8 text-xs font-medium"
              onClick={() => setActiveTab("registry")}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Fleet Registry (Table View)</span>
            </Button>
            <Button
              size="sm"
              variant={activeTab === "kanban" ? "default" : "outline"}
              className="gap-1.5 h-8 text-xs font-medium"
              onClick={() => setActiveTab("kanban")}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Availability Board (Kanban View)</span>
            </Button>
          </div>

          {/* Action to Register Ambulance */}
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs font-medium self-start lg:self-auto" onClick={openAddModal}>
            <Plus className="h-3.5 w-3.5" />
            <span>Register New Ambulance</span>
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Search vehicle, driver, equipment..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Ambulance Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Vehicle Types</SelectItem>
                <SelectItem value="ALS">Advanced Life Support (ALS)</SelectItem>
                <SelectItem value="BLS">Basic Life Support (BLS)</SelectItem>
                <SelectItem value="Neonatal ICU">Neonatal ICU Transport</SelectItem>
                <SelectItem value="Patient Transport">Patient Transport Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Availability Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Availability States</SelectItem>
                {ALL_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Base Campus Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Base Locations</SelectItem>
                <SelectItem value="Qlyno Main Campus">Qlyno Main Campus (Andheri)</SelectItem>
                <SelectItem value="Qlyno City Center">Qlyno City Center (BKC)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* TAB 1: FLEET REGISTRY TABLE VIEW */}
        {activeTab === "registry" && (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-xs">Vehicle Registration</TableHead>
                  <TableHead className="font-semibold text-xs">Type & Equipment</TableHead>
                  <TableHead className="font-semibold text-xs">Base Location</TableHead>
                  <TableHead className="font-semibold text-xs">Driver & Crew</TableHead>
                  <TableHead className="font-semibold text-xs">Active Case</TableHead>
                  <TableHead className="font-semibold text-xs w-[180px]">Availability State</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAmbulances.map((amb) => {
                  const cfg = STATUS_CONFIG[amb.status];
                  return (
                    <TableRow key={amb.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="cursor-pointer" onClick={() => openDetailsModal(amb)}>
                        <div className="font-bold text-sm text-foreground flex items-center gap-2 hover:text-primary transition-colors">
                          <AmbulanceIcon className="h-4 w-4 text-primary" />
                          <span>{amb.vehicleNo}</span>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">{amb.id}</span>
                      </TableCell>

                      <TableCell className="cursor-pointer" onClick={() => openDetailsModal(amb)}>
                        <Badge variant="secondary" className="text-[10px] mb-1 font-semibold">
                          {amb.type}
                        </Badge>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {amb.equipment.slice(0, 3).map((eq, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] bg-background">
                              {eq}
                            </Badge>
                          ))}
                          {amb.equipment.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{amb.equipment.length - 3} more</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground cursor-pointer" onClick={() => openDetailsModal(amb)}>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{amb.baseLocation}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs cursor-pointer" onClick={() => openDetailsModal(amb)}>
                        {amb.driver ? (
                          <div>
                            <p className="font-semibold text-foreground">{amb.driver.name}</p>
                            <p className="text-[11px] text-muted-foreground">{amb.driver.phone}</p>
                            {amb.crew && amb.crew.length > 0 && (
                              <p className="text-[10px] text-primary mt-0.5">
                                Crew: {amb.crew.map((c) => `${c.name} (${c.role})`).join(", ")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No crew assigned</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        {amb.currentCaseId ? (
                          <Link
                            href={`/hospital-admin/emergency/${amb.currentCaseId}`}
                            className="font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            <span>{amb.currentCaseId}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Standby</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Select
                          value={amb.status}
                          onValueChange={(val: AmbulanceStatus) => handleStatusChange(amb, val)}
                        >
                          <SelectTrigger className={`h-8 text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_STATUSES.map((st) => (
                              <SelectItem key={st} value={st}>
                                {st}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuLabel>Vehicle Controls</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetailsModal(amb)}>
                              <Eye className="mr-2 h-3.5 w-3.5 text-primary" /> View Vehicle Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(amb)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Registry Info
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCrewModal(amb)}>
                              <Users className="mr-2 h-3.5 w-3.5 text-primary" /> Assign Driver & Crew
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {amb.status === "Available" ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(amb, "Maintenance/Offline")}>
                                <Wrench className="mr-2 h-3.5 w-3.5 text-warning" /> Mark as Maintenance
                              </DropdownMenuItem>
                            ) : amb.status === "Maintenance/Offline" ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(amb, "Available")}>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-success" /> Restore to Available
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleStatusChange(amb, "Available")}>
                                <RefreshCw className="mr-2 h-3.5 w-3.5 text-success" /> Clear / Free Ambulance
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredAmbulances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <AmbulanceIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-sm">No ambulances found</p>
                      <p className="text-xs mt-0.5">Try clearing filters or search query.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 2: AVAILABILITY STATUS KANBAN BOARD */}
        {activeTab === "kanban" && (
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <div className="grid grid-cols-7 gap-3 min-w-[1200px]">
              {ALL_STATUSES.map((statusKey) => {
                const cfg = STATUS_CONFIG[statusKey];
                const list = ambulances.filter((a) => a.status === statusKey);

                return (
                  <div
                    key={statusKey}
                    className="flex flex-col bg-muted/20 border border-border rounded-xl p-3 min-h-[480px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                      <span className="text-xs font-bold text-foreground truncate">{statusKey}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono h-5 px-1.5">
                        {list.length}
                      </Badge>
                    </div>

                    {/* Cards List */}
                    <div className="space-y-2.5 flex-1">
                      {list.map((amb) => (
                        <div
                          key={amb.id}
                          className="bg-card border border-border rounded-lg p-3 shadow-sm hover:border-primary/50 transition-all space-y-2 text-xs"
                        >
                          <div
                            className="flex items-center justify-between cursor-pointer hover:opacity-80"
                            onClick={() => openDetailsModal(amb)}
                          >
                            <span className="font-bold text-foreground flex items-center gap-1.5 hover:text-primary transition-colors">
                              <AmbulanceIcon className="h-3.5 w-3.5 text-primary" />
                              {amb.vehicleNo}
                            </span>
                            <Badge variant="outline" className="text-[9px]">
                              {amb.type}
                            </Badge>
                          </div>

                          <div
                            className="text-[11px] text-muted-foreground space-y-0.5 cursor-pointer"
                            onClick={() => openDetailsModal(amb)}
                          >
                            <p>Base: <strong className="text-foreground">{amb.baseLocation}</strong></p>
                            <p>Driver: <strong className="text-foreground">{amb.driver?.name || "Unassigned"}</strong></p>
                            {amb.currentCaseId && (
                              <p className="text-destructive font-semibold">Case: {amb.currentCaseId}</p>
                            )}
                          </div>

                          {/* Quick Status Progression Selector */}
                          <div className="pt-2 border-t border-border/60">
                            <Select
                              value={amb.status}
                              onValueChange={(val: AmbulanceStatus) => handleStatusChange(amb, val)}
                            >
                              <SelectTrigger className="h-7 text-[11px] font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_STATUSES.map((st) => (
                                  <SelectItem key={st} value={st} className="text-xs">
                                    Move to: {st}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}

                      {list.length === 0 && (
                        <div className="h-32 border border-dashed border-border/80 rounded-lg flex items-center justify-center text-[11px] text-muted-foreground text-center p-2">
                          No ambulances in {statusKey}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* DISPATCH CREATION MODAL */}
      <DispatchCreationModal open={showDispatchModal} onOpenChange={setShowDispatchModal} />

      {/* REGISTER / EDIT AMBULANCE MODAL */}
      <Dialog open={showVehicleModal} onOpenChange={setShowVehicleModal}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveVehicle}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <AmbulanceIcon className="h-5 w-5 text-primary" />
                <span>{editingAmbulance ? "Edit Ambulance Details" : "Register New Fleet Ambulance"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingAmbulance
                  ? `Update registration, equipment capabilities and base facility for ${editingAmbulance.vehicleNo}.`
                  : "Add a new certified ambulance vehicle to the hospital fleet registry."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Vehicle Registration No <span className="text-destructive">*</span></Label>
                  <Input
                    required
                    placeholder="e.g. MH-12-AB-1234"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Ambulance Type</Label>
                  <Select value={vehicleType} onValueChange={(val: AmbulanceType) => setVehicleType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALS">Advanced Life Support (ALS)</SelectItem>
                      <SelectItem value="BLS">Basic Life Support (BLS)</SelectItem>
                      <SelectItem value="Neonatal ICU">Neonatal ICU Transport</SelectItem>
                      <SelectItem value="Patient Transport">Patient Transport Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Base Campus Location</Label>
                <Select value={baseLocation} onValueChange={setBaseLocation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Qlyno Main Campus">Qlyno Main Campus (Andheri West)</SelectItem>
                    <SelectItem value="Qlyno City Center">Qlyno City Center (BKC Complex)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Equipment Capabilities Checkbox Chips */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Equipment Capabilities & Facilities</Label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-border bg-muted/20">
                  {STANDARD_EQUIPMENT.map((eq) => {
                    const isSelected = selectedEquipment.includes(eq);
                    return (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEquipment(selectedEquipment.filter((item) => item !== eq));
                          } else {
                            setSelectedEquipment([...selectedEquipment, eq]);
                          }
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-background border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {eq}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Maintenance Notes */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Maintenance & Service Log Notes</Label>
                <Textarea
                  placeholder="e.g. Next inspection due in 30 days, O2 cylinder pressure verified."
                  value={maintenanceNotes}
                  onChange={(e) => setMaintenanceNotes(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setShowVehicleModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAmbulance ? "Save Changes" : "Register Ambulance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DRIVER & CREW ASSIGNMENT MODAL (Rule CAN #3-5) */}
      <Dialog open={!!crewModalAmb} onOpenChange={(open) => !open && setCrewModalAmb(null)}>
        <DialogContent className="max-w-lg">
          {crewModalAmb && (
            <form onSubmit={handleSaveCrew}>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span>Assign Driver & Crew — {crewModalAmb.vehicleNo}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Assign licensed ambulance driver, emergency paramedics, and EMT specialists per hospital policy.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-3 text-xs">
                {/* Driver Details */}
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Primary Driver Assignment
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Driver Full Name *</Label>
                      <Input
                        required
                        placeholder="e.g. Ramesh Patel"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Driver Phone *</Label>
                      <Input
                        required
                        placeholder="+91 98220 11921"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Commercial License / Badge No</Label>
                      <Input
                        placeholder="DL-MH-2018-9921"
                        value={driverLicense}
                        onChange={(e) => setDriverLicense(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Duty Shift</Label>
                      <Select value={driverShift} onValueChange={setDriverShift}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Day Shift (08:00 - 16:00)">Day Shift (08:00 - 16:00)</SelectItem>
                          <SelectItem value="Evening Shift (16:00 - 00:00)">Evening Shift (16:00 - 00:00)</SelectItem>
                          <SelectItem value="Night Shift (00:00 - 08:00)">Night Shift (00:00 - 08:00)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Crew Members List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" /> On-Board Paramedic & EMT Crew
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() =>
                        setCrewList([...crewList, { name: "", role: "Paramedic", phone: "" }])
                      }
                    >
                      + Add Member
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {crewList.map((crewItem, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border">
                        <div className="col-span-5">
                          <Input
                            placeholder="Crew member name"
                            value={crewItem.name}
                            onChange={(e) => {
                              const updated = [...crewList];
                              updated[idx].name = e.target.value;
                              setCrewList(updated);
                            }}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={crewItem.role}
                            onValueChange={(val: any) => {
                              const updated = [...crewList];
                              updated[idx].role = val;
                              setCrewList(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 text-[11px] bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Paramedic">Paramedic</SelectItem>
                              <SelectItem value="EMT">EMT</SelectItem>
                              <SelectItem value="Emergency Nurse">Nurse</SelectItem>
                              <SelectItem value="Triage Specialist">Triage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder="Phone number"
                            value={crewItem.phone}
                            onChange={(e) => {
                              const updated = [...crewList];
                              updated[idx].phone = e.target.value;
                              setCrewList(updated);
                            }}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setCrewList(crewList.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setCrewModalAmb(null)}>
                  Cancel
                </Button>
                <Button type="submit">Assign Driver & Crew</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* AMBULANCE VEHICLE PROFILE & DETAILS MODAL */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingAmbulance && (
            <div>
              <DialogHeader>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <AmbulanceIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <span>{viewingAmbulance.vehicleNo}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {viewingAmbulance.type}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs font-mono text-muted-foreground">
                        Vehicle Identifier: {viewingAmbulance.id}
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge className={`${STATUS_CONFIG[viewingAmbulance.status].bg} ${STATUS_CONFIG[viewingAmbulance.status].text} font-bold text-xs`}>
                    {viewingAmbulance.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {/* Quick Metric Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Base Location</span>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{viewingAmbulance.baseLocation}</span>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Telemetry State</span>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <Radio className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{viewingAmbulance.telemetry.isGpsOnline ? `GPS Online (${viewingAmbulance.telemetry.speedKmH} km/h)` : "GPS Offline"}</span>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Active Mission</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {viewingAmbulance.currentCaseId ? (
                        <Link
                          href={`/hospital-admin/emergency/${viewingAmbulance.currentCaseId}`}
                          className="text-primary hover:underline flex items-center gap-1 font-bold"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span>{viewingAmbulance.currentCaseId}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">Standby / Available</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Assigned Driver & Crew Members */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Assigned Driver & On-Board Personnel</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2.5"
                      onClick={() => {
                        setShowDetailsModal(false);
                        openCrewModal(viewingAmbulance);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Manage Crew
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <User className="h-3 w-3 text-primary" /> Primary Driver
                      </span>
                      {viewingAmbulance.driver ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground text-sm">{viewingAmbulance.driver.name}</p>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {viewingAmbulance.driver.phone}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            License: <strong className="text-foreground">{viewingAmbulance.driver.licenseNo}</strong>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Shift: <strong className="text-foreground">{viewingAmbulance.driver.shift}</strong>
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic pt-1">No driver assigned to this vehicle.</p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-primary" /> On-Board Paramedic & EMT Crew
                      </span>
                      {viewingAmbulance.crew && viewingAmbulance.crew.length > 0 ? (
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                          {viewingAmbulance.crew.map((member, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] border-b border-border/40 pb-1 last:border-0 last:pb-0">
                              <div>
                                <p className="font-semibold text-foreground">{member.name}</p>
                                <p className="text-[10px] text-muted-foreground">{member.phone}</p>
                              </div>
                              <Badge variant="outline" className="text-[9px] h-5">
                                {member.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic pt-1">No paramedics or EMTs attached.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Medical Equipment Readiness */}
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Certified On-Board Equipment & Medical Capabilities</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingAmbulance.equipment.map((eq, i) => (
                      <Badge key={i} variant="secondary" className="text-[11px] px-2 py-0.5 font-medium">
                        ✓ {eq}
                      </Badge>
                    ))}
                    {viewingAmbulance.equipment.length === 0 && (
                      <span className="text-muted-foreground italic">Standard first aid kit only</span>
                    )}
                  </div>
                </div>

                {/* Maintenance & Service Notes */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-warning" />
                    <span>Maintenance & Inspection Service Notes</span>
                  </span>
                  <p className="text-foreground bg-background p-2.5 rounded-lg border border-border leading-relaxed">
                    {viewingAmbulance.maintenanceNotes || "All routine vehicular and biomedical calibrations certified within operational parameters."}
                  </p>
                </div>
              </div>

              <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(viewingAmbulance);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Vehicle
                  </Button>
                  {viewingAmbulance.status === "Available" && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1 text-xs font-semibold"
                      onClick={() => {
                        setShowDetailsModal(false);
                        setShowDispatchModal(true);
                      }}
                    >
                      <Play className="h-3.5 w-3.5" /> Create Dispatch
                    </Button>
                  )}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowDetailsModal(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
