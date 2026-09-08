"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Lock,
  MapPin,
  Printer,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";

import { Badge } from "@/hospital-admin/components/ui/badge";
import { Button } from "@/hospital-admin/components/ui/button";
import { Card } from "@/hospital-admin/components/ui/card";
import { Input } from "@/hospital-admin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/hospital-admin/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/hospital-admin/components/ui/table";
import { PageHeader } from "@/hospital-admin/components/shared/page-header";
import { AppDispatch, RootState } from "@/hospital-admin/store/store";
import { DispatchStatus, hydrateAmbulanceState } from "@/hospital-admin/store/slices/ambulanceSlice";
import { useToast } from "@/hospital-admin/hooks/use-toast";
import { getBackendAmbulanceState, getHmsAuthSession } from "@/hospital-admin/lib/hms-api";

const STATUS_BADGES: Record<
  DispatchStatus,
  { bg: string; text: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  Created: { bg: "bg-muted text-muted-foreground", text: "text-muted-foreground", variant: "secondary" },
  Assigned: { bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300", text: "text-blue-700", variant: "outline" },
  "In Progress": { bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300", text: "text-amber-700", variant: "secondary" },
  Completed: { bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", text: "text-emerald-700", variant: "default" },
  "Re-routed": { bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300", text: "text-purple-700", variant: "outline" },
  Cancelled: { bg: "bg-destructive/10 text-destructive", text: "text-destructive", variant: "destructive" },
};

export default function AmbulanceHistoryPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  const history = useSelector((state: RootState) => state.ambulance.dispatchHistory);
  const ambulances = useSelector((state: RootState) => state.ambulance.fleet);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [vehicleFilter, setVehicleFilter] = useState("All");

  useEffect(() => {
    if (!getHmsAuthSession()) return;
    getBackendAmbulanceState()
      .then((state) => dispatch(hydrateAmbulanceState({ fleet: state.fleet, dispatchHistory: state.dispatchHistory })))
      .catch((error) => console.warn("Failed to load backend ambulance history:", error));
  }, [dispatch]);

  const filteredHistory = useMemo(() => {
    return history
      .filter((log) => {
        const matchSearch =
          log.id.toLowerCase().includes(search.toLowerCase()) ||
          (log.caseId && log.caseId.toLowerCase().includes(search.toLowerCase())) ||
          (log.patientName && log.patientName.toLowerCase().includes(search.toLowerCase())) ||
          log.destinationHospital.toLowerCase().includes(search.toLowerCase()) ||
          log.originAddress.toLowerCase().includes(search.toLowerCase()) ||
          log.vehicleNo.toLowerCase().includes(search.toLowerCase());

        const matchStatus = statusFilter === "All" || log.status === statusFilter;
        const matchVehicle = vehicleFilter === "All" || log.ambulanceId === vehicleFilter;

        return matchSearch && matchStatus && matchVehicle;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [history, search, statusFilter, vehicleFilter]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      "Dispatch ID",
      "Vehicle No",
      "Case ID",
      "Patient Name",
      "Origin Address",
      "Destination Hospital",
      "Priority",
      "Status",
      "Dispatched At",
      "Hospital Arrival",
    ];

    const rows = filteredHistory.map((h) => [
      h.id,
      h.vehicleNo,
      h.caseId || "N/A",
      h.isPatientLinked && h.patientName ? h.patientName : "Anonymized",
      `"${h.originAddress}"`,
      `"${h.destinationHospital}"`,
      h.priority,
      h.status,
      h.timestamps?.dispatched || h.timestamp,
      h.timestamps?.arrivedHospital || "N/A",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ambulance_Dispatch_History_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "History Exported",
      description: "Dispatch logs downloaded as CSV. • Performed by Hospital Admin • acting within Ambulance Dispatch workflow",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/hospital-admin/ambulance">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title="Dispatch & Transport History"
            description="Complete audit trail of all ambulance dispatches, patient transit milestones, destination diversions, and run sheets."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExportCSV}>
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handlePrint}>
            <Printer className="h-4 w-4 text-muted-foreground" />
            <span>Print Manifest</span>
          </Button>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden text-xs">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Search dispatch ID, case, patient, hospital..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Dispatch Statuses</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Re-routed">Re-routed / Diverted</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by Vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Ambulance Vehicles</SelectItem>
                {ambulances.map((amb) => (
                  <SelectItem key={amb.id} value={amb.id}>
                    {amb.vehicleNo} ({amb.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* History Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-semibold text-xs w-[110px]">Dispatch ID</TableHead>
                <TableHead className="font-semibold text-xs">Vehicle & Crew</TableHead>
                <TableHead className="font-semibold text-xs">Mission & Patient</TableHead>
                <TableHead className="font-semibold text-xs">Origin / Scene</TableHead>
                <TableHead className="font-semibold text-xs">Destination Hospital</TableHead>
                <TableHead className="font-semibold text-xs">Timestamps</TableHead>
                <TableHead className="font-semibold text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((log) => {
                const amb = ambulances.find((a) => a.id === log.ambulanceId);
                const badgeCfg = STATUS_BADGES[log.status] || STATUS_BADGES["In Progress"];

                return (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors text-xs">
                    <TableCell>
                      <span className="font-mono font-bold text-foreground">{log.id}</span>
                      <p className="text-[10px] text-muted-foreground">{log.priority}</p>
                    </TableCell>

                    <TableCell>
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <AmbulanceIcon className="h-3.5 w-3.5 text-primary" />
                        <span>{log.vehicleNo}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Driver: {amb?.driver?.name || "Assigned Driver"}
                      </p>
                    </TableCell>

                    <TableCell>
                      {log.caseId ? (
                        <Link
                          href={`/hospital-admin/emergency/${log.caseId}`}
                          className="font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          <span>{log.caseId}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">Direct Dispatch</span>
                      )}

                      {log.isPatientLinked && log.patientName ? (
                        <p className="text-[11px] text-foreground font-medium flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{log.patientName}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-warning flex items-center gap-1 mt-0.5">
                          <Lock className="h-3 w-3" />
                          <span>Anonymized Trauma Record</span>
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{log.originAddress}</span>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[220px]">
                      <p className="font-semibold text-foreground truncate">{log.destinationHospital}</p>
                      {log.reRouteHistory && log.reRouteHistory.length > 0 && (
                        <Badge variant="outline" className="text-[9px] text-purple-700 dark:text-purple-300 mt-0.5 border-purple-500/30">
                          Diverted ({log.reRouteHistory[0].reason.slice(0, 24)}...)
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>Dispatched: {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="text-[10px]">
                        {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge className={`${badgeCfg.bg} font-bold text-[10px]`}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">No dispatch history records found</p>
                    <p className="text-xs mt-0.5">Dispatches completed or created will automatically appear here.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
