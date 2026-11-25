"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import QRCode from "qrcode"
import { StatusBadge } from "@/components/StatusBadge"
import { SignatureCanvas } from "@/components/SignatureCanvas"
import { AuditLogTimeline } from "@/components/AuditLogTimeline"
import { PERMIT_TYPE_REGISTRY } from "@/lib/permitTypeConfig"
import { 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Lock, 
  Plus, 
  QrCode, 
  FileCheck,
  Send,
  UserCheck
} from "lucide-react"

export default function PermitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const permitId = params.id as string

  const [permit, setPermit] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [actionLoading, setActionLoading] = useState(false)

  // Modals state
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showClosureModal, setShowClosureModal] = useState(false)
  const [showVerifyClosureModal, setShowVerifyClosureModal] = useState(false)
  const [showExtensionModal, setShowExtensionModal] = useState(false)

  // Form states inside modals
  const [approvalDecision, setApprovalDecision] = useState<"APPROVED" | "REJECTED">("APPROVED")
  const [approvalComment, setApprovalComment] = useState("")
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [completionNotes, setCompletionNotes] = useState("")
  const [verificationNotes, setVerificationNotes] = useState("")
  const [extensionHours, setExtensionHours] = useState(2)
  const [extensionReason, setExtensionReason] = useState("")

  // Confined space entry log inputs
  const [entryPersonName, setEntryPersonName] = useState("")
  const [entryBadgeNumber, setEntryBadgeNumber] = useState("")

  const loadPermit = async () => {
    try {
      const [uRes, pRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()),
        fetch(`/api/permits/${permitId}`).then((r) => r.json()),
      ])

      if (!uRes.user) {
        router.push("/login")
        return
      }
      setCurrentUser(uRes.user)
      setPermit(pRes.permit)

      // Generate QR Code data URL
      const currentUrl = window.location.href
      const qrData = await QRCode.toDataURL(currentUrl, { width: 180, margin: 1 })
      setQrCodeUrl(qrData)
    } catch (err: any) {
      setError(err.message || "Failed to load permit")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermit()
  }, [permitId])

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading permit record...</div>
  }

  if (!permit) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Permit not found.{" "}
        <Link href="/" className="text-blue-600 underline">
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const isRequester = currentUser?.id === permit.requesterId
  const isSafetyOfficer = currentUser?.role === "SAFETY_OFFICER"
  const isAdmin = currentUser?.role === "ADMIN"
  const isAreaOwner =
    currentUser?.role === "AREA_OWNER" &&
    (currentUser?.assignedAreaIds?.includes(permit.areaId) ||
      permit.area?.assignedUsers?.some((u: any) => u.userId === currentUser?.id))

  // Check if current user can approve
  const canUserApprove =
    permit.status === "PENDING_APPROVAL" &&
    !isRequester && // Self-approval ban
    (isSafetyOfficer || isAreaOwner || isAdmin)

  // Execute State Machine Action
  const executeAction = async (action: string, payload: any = {}) => {
    setError("")
    setActionLoading(true)

    try {
      const res = await fetch(`/api/permits/${permit.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Action failed")
      } else {
        setShowApprovalModal(false)
        setShowSuspendModal(false)
        setShowClosureModal(false)
        setShowVerifyClosureModal(false)
        loadPermit()
      }
    } catch (err: any) {
      setError("Network error executing action")
    } finally {
      setActionLoading(false)
    }
  }

  // Request Extension
  const submitExtensionRequest = async () => {
    setError("")
    setActionLoading(true)
    try {
      const res = await fetch(`/api/permits/${permit.id}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedHours: extensionHours,
          reason: extensionReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to request extension")
      } else {
        setShowExtensionModal(false)
        setExtensionReason("")
        loadPermit()
      }
    } catch (err: any) {
      setError("Network error")
    } finally {
      setActionLoading(false)
    }
  }

  // Review Extension
  const reviewExtension = async (extensionId: string, decision: "APPROVED" | "REJECTED") => {
    setError("")
    setActionLoading(true)
    try {
      const res = await fetch(`/api/permits/${permit.id}/extensions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extensionId,
          decision,
          comment: `Reviewed by ${currentUser.name}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to review extension")
      } else {
        loadPermit()
      }
    } catch (err: any) {
      setError("Network error")
    } finally {
      setActionLoading(false)
    }
  }

  // Confined Space Entry/Exit Log
  const handleLogEntry = async () => {
    if (!entryPersonName || !entryBadgeNumber) {
      setError("Person name and badge number required")
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/permits/${permit.id}/entry-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ENTRY",
          personName: entryPersonName,
          badgeNumber: entryBadgeNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        setEntryPersonName("")
        setEntryBadgeNumber("")
        loadPermit()
      }
    } catch (err: any) {
      setError("Network error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleLogExit = async (logId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/permits/${permit.id}/entry-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXIT",
          logId,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error)
      else loadPermit()
    } catch (err: any) {
      setError("Network error")
    } finally {
      setActionLoading(false)
    }
  }

  const config = PERMIT_TYPE_REGISTRY[permit.type as keyof typeof PERMIT_TYPE_REGISTRY]
  const typeData = (permit.typeSpecificData as any) || {}
  const precautions = Array.isArray(permit.precautionsChecklist) ? permit.precautionsChecklist : []
  const entryLogs = Array.isArray(typeData.entryExitLog) ? typeData.entryExitLog : []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="text-xs text-slate-500 font-mono">
          Logged in: <span className="font-semibold text-slate-800">{currentUser?.name}</span> ({currentUser?.role})
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Permit Overview Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-mono font-bold text-[#0F172A] tracking-tight">
                {permit.permitNumber}
              </h1>
              <StatusBadge status={permit.status} />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {config?.label || permit.type}
            </div>
            <p className="text-xs text-[#475569] max-w-xl">
              {permit.workDescription}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
              <span>Facility: <strong>{permit.plant?.name}</strong></span>
              <span>•</span>
              <span>Area: <strong>{permit.area?.name}</strong></span>
              <span>•</span>
              <span>Team: <strong>{permit.contractorTeam}</strong></span>
              <span>•</span>
              <span>Raised by: <strong>{permit.requester?.name}</strong></span>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="Permit QR Code" className="w-28 h-28 mix-blend-multiply" />
            )}
            <span className="text-[10px] text-slate-500 font-mono mt-1">Scan for Field Status</span>
          </div>
        </div>

        {/* Action Controls Bar (Only render allowed actions for user role & state) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Available Actions
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* EDIT DRAFT (for DRAFT) */}
            {permit.status === "DRAFT" && (isRequester || isAdmin) && (
              <Link
                href={`/permits/new?editDraftId=${permit.id}`}
                className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition border border-slate-300"
              >
                Edit Draft
              </Link>
            )}

            {/* SUBMIT (for DRAFT) */}
            {permit.status === "DRAFT" && (isRequester || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => executeAction("SUBMIT")}
                className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                Submit for Approval
              </button>
            )}

            {/* REVIEW / APPROVE (for PENDING_APPROVAL) */}
            {canUserApprove && (
              <button
                disabled={actionLoading}
                onClick={() => setShowApprovalModal(true)}
                className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Review & Sign Approval
              </button>
            )}

            {/* ACTIVATE (for APPROVED) */}
            {permit.status === "APPROVED" && (isRequester || isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => executeAction("ACTIVATE")}
                className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" />
                Activate on Shop Floor
              </button>
            )}

            {/* SUSPEND (for ACTIVE - Safety Officer / Admin) */}
            {permit.status === "ACTIVE" && (isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => setShowSuspendModal(true)}
                className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Pause className="w-3.5 h-3.5" />
                Suspend Work
              </button>
            )}

            {/* RESUME (for SUSPENDED - Safety Officer / Admin) */}
            {permit.status === "SUSPENDED" && (isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => executeAction("RESUME", { reason: "Safety clearances confirmed" })}
                className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" />
                Resume Work
              </button>
            )}

            {/* EXTEND TIME (for ACTIVE) */}
            {permit.status === "ACTIVE" && (isRequester || isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => setShowExtensionModal(true)}
                className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Request Extension
              </button>
            )}

            {/* CLOSE (for ACTIVE - Requester / Safety) */}
            {permit.status === "ACTIVE" && (isRequester || isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => setShowClosureModal(true)}
                className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Close Permit (Work Complete)
              </button>
            )}

            {/* VERIFY CLOSURE (for CLOSED - Safety Officer / Admin) */}
            {permit.status === "CLOSED" && (isSafetyOfficer || isAdmin) && (
              <button
                disabled={actionLoading}
                onClick={() => setShowVerifyClosureModal(true)}
                className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verify Site Safety & Closeout
              </button>
            )}

            {/* CANCEL (for non-terminal) */}
            {["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED"].includes(permit.status) &&
              (isRequester || isAdmin) && (
                <button
                  disabled={actionLoading}
                  onClick={() => {
                    const r = prompt("Reason for cancellation:")
                    if (r) executeAction("CANCEL", { reason: r })
                  }}
                  className="min-h-[44px] px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition"
                >
                  Cancel Permit
                </button>
              )}
          </div>
        </div>

        {/* Validity & Time Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Planned Schedule</span>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {new Date(permit.plannedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" - "}
              {new Date(permit.plannedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[11px] text-slate-500">
              {new Date(permit.plannedStart).toLocaleDateString("en-IN")}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Effective Validity</span>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {permit.extendedUntil
                ? new Date(permit.extendedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : new Date(permit.plannedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold">
              {permit.extendedUntil ? "Extended by Safety Approval" : "Original Window"}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Equipment / Isolation</span>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {permit.equipment ? `${permit.equipment.tagCode}` : "Not Tagged"}
            </div>
            <div className="text-[11px] text-slate-500">
              {permit.equipment?.name || "General Area Work"}
            </div>
          </div>
        </div>

        {/* Section: Dual Required Approvals Status */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Required Multi-Tier Safety Sign-Offs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {permit.approvals?.map((app: any) => (
              <div
                key={app.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {app.requiredRole.replace(/_/g, " ")} Sign-off
                  </span>
                  <StatusBadge status={app.decision} />
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {app.decision === "APPROVED" ? (
                    <div>
                      <div className="font-semibold text-emerald-800">
                        ✓ Approved by {app.approver?.name || "Authorized Person"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(app.reviewedAt).toLocaleString("en-IN")}
                      </div>
                      {app.signatureDataUrl && (
                        <div className="mt-2 p-1 bg-white border border-slate-200 rounded w-fit">
                          <img src={app.signatureDataUrl} alt="Signature" className="h-10 object-contain" />
                        </div>
                      )}
                    </div>
                  ) : app.decision === "REJECTED" ? (
                    <div className="text-red-700 font-medium">
                      ✕ Rejected: "{app.comment}"
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">
                      Pending review & digital signature
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Type-Specific Details Card */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {config?.label} - Field Safety Parameters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            {config?.fields.map((f) => {
              const val = typeData[f.name]
              return (
                <div key={f.name}>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">{f.label}</span>
                  <div className="font-mono font-medium text-slate-900 mt-0.5">
                    {typeof val === "boolean"
                      ? val ? "YES / VERIFIED" : "NO"
                      : Array.isArray(val)
                      ? val.join(", ")
                      : String(val || "N/A")}
                    {f.unit ? ` ${f.unit}` : ""}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section: Confined Space Entry/Exit Log (Shop-floor active logging) */}
        {permit.type === "CONFINED_SPACE" && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Confined Space Personnel Entry/Exit Log
              </h2>
              <span className="text-[11px] text-slate-500">
                Active Entrants: {entryLogs.filter((l: any) => !l.exitTime).length}
              </span>
            </div>

            {/* Input Form for New Entry (Only when ACTIVE) */}
            {permit.status === "ACTIVE" ? (
              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Technician Full Name"
                  value={entryPersonName}
                  onChange={(e) => setEntryPersonName(e.target.value)}
                  className="w-full sm:flex-1 min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
                <input
                  type="text"
                  placeholder="ID / Badge #"
                  value={entryBadgeNumber}
                  onChange={(e) => setEntryBadgeNumber(e.target.value)}
                  className="w-full sm:w-36 min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
                <button
                  onClick={handleLogEntry}
                  disabled={actionLoading}
                  className="w-full sm:w-auto min-h-[40px] px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-lg transition"
                >
                  Log Entry
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Entry logging is only active when the permit status is ACTIVE.
              </div>
            )}

            {/* Log Table */}
            {entryLogs.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Personnel</th>
                      <th className="py-2 px-3">Badge</th>
                      <th className="py-2 px-3">Entry Time</th>
                      <th className="py-2 px-3">Exit Time</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {entryLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{log.personName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{log.badgeNumber}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {new Date(log.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {log.exitTime
                            ? new Date(log.exitTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : <span className="text-amber-700 font-bold">INSIDE VESSEL</span>}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {!log.exitTime && permit.status === "ACTIVE" && (
                            <button
                              onClick={() => handleLogExit(log.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium text-[11px]"
                            >
                              Log Exit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Section: Extensions Log */}
        {permit.extensions && permit.extensions.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Extension Requests
            </h2>
            <div className="space-y-2">
              {permit.extensions.map((ext: any) => (
                <div
                  key={ext.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">+{ext.requestedHours} Hours</span>
                    <span className="text-slate-500 ml-2">Reason: "{ext.reason}"</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Requested by {ext.requestedBy?.name} on {new Date(ext.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ext.status} />
                    {ext.status === "PENDING" && (isSafetyOfficer || isAdmin) && !isRequester && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => reviewExtension(ext.id, "APPROVED")}
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewExtension(ext.id, "REJECTED")}
                          className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Human-Readable Audit Timeline */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Immutable Audit Trail & Activity Timeline
          </h2>
          <AuditLogTimeline logs={permit.auditLogs || []} />
        </div>
      </div>

      {/* MODAL 1: Approval Modal with Canvas Signature */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Permit Safety Verification & Approval
            </h3>
            <p className="text-xs text-slate-600">
              Confirm that site inspections, atmospheric checks, and safety precautions are verified in person.
            </p>

            <div className="flex gap-4 text-xs font-semibold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={approvalDecision === "APPROVED"}
                  onChange={() => setApprovalDecision("APPROVED")}
                />
                <span className="text-emerald-700">Approve Permit</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={approvalDecision === "REJECTED"}
                  onChange={() => setApprovalDecision("REJECTED")}
                />
                <span className="text-red-700">Reject Permit (Mandatory Reason)</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Approver Comments {approvalDecision === "REJECTED" && <span className="text-red-600">*</span>}
              </label>
              <textarea
                rows={2}
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={approvalDecision === "REJECTED" ? "State mandatory reason for rejection..." : "Safety remarks..."}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>

            {/* Canvas Signature (Optional / Capturable) */}
            {approvalDecision === "APPROVED" && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Digital Signature (Draw with Touch or Mouse)
                </label>
                <SignatureCanvas
                  onSave={(dataUrl) => setSignatureData(dataUrl)}
                  onClear={() => setSignatureData(null)}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  executeAction("REVIEW_APPROVAL", {
                    decision: approvalDecision,
                    comment: approvalComment,
                    signatureDataUrl: signatureData,
                  })
                }
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 text-amber-700 flex items-center gap-2">
              <Pause className="w-5 h-5" /> Suspend Work Permit
            </h3>
            <p className="text-xs text-slate-600">
              Mandatory safety reason is required to pause ongoing hot work, confined space, or elevated work.
            </p>
            <textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Sudden rain and lightning storm, gas sensor alert, unstable scaffolding..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !suspendReason.trim()}
                onClick={() => executeAction("SUSPEND", { reason: suspendReason })}
                className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Closure Modal (Requester) */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-800" /> Work Completion Handover
            </h3>
            <p className="text-xs text-slate-600">
              Requester confirms work finished, personnel exited, and equipment restored to normal state.
            </p>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Summary of work completed, de-isolation, site clean-up..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClosureModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => executeAction("CLOSE", { completionNotes })}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-black text-white rounded-lg"
              >
                Mark Closed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Verify Closure Modal (Safety Officer) */}
      {showVerifyClosureModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Safety Officer Closure Verification
            </h3>
            <p className="text-xs text-slate-600">
              Verify that the work area is clean, all scrap removed, fire watch completed, and area is certified safe for operational handover.
            </p>
            <textarea
              rows={3}
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder="e.g. Site inspected, housekeeping verified, all padlocks de-isolated, area safe."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVerifyClosureModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => executeAction("VERIFY_CLOSURE", { verificationNotes })}
                className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
              >
                Sign Off & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Extension Request Modal */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Request Work Time Extension
            </h3>
            <p className="text-xs text-slate-600">
              Max 4 hours per request (capped at 2 extensions max per permit). Requires Safety Officer review.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Extension Duration (Hours)
              </label>
              <select
                value={extensionHours}
                onChange={(e) => setExtensionHours(Number(e.target.value))}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value={1}>+1 Hour</option>
                <option value={2}>+2 Hours</option>
                <option value={3}>+3 Hours</option>
                <option value={4}>+4 Hours (Maximum)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Reason for Extension
              </label>
              <textarea
                rows={2}
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="Reason additional time is required..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !extensionReason.trim()}
                onClick={submitExtensionRequest}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
