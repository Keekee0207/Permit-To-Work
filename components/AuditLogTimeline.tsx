/**
 * ============================================================================
 * IMMUTABLE AUDIT LOG TIMELINE COMPONENT
 * ============================================================================
 * Visual vertical timeline showing every historical event and state mutation
 * in a permit's lifecycle (submission, approvals, suspensions, closures).
 */

import { AuditLog } from "@prisma/client"
import { CheckCircle2, Clock, AlertTriangle, XCircle, Shield, FileText, UserCheck } from "lucide-react"

interface AuditLogTimelineProps {
  logs: (AuditLog & { actor?: { name: string; role: string } | null })[]
}

export function AuditLogTimeline({ logs }: AuditLogTimelineProps) {
  if (!logs || logs.length === 0) {
    return <div className="text-xs text-slate-500 py-4">No audit logs recorded yet.</div>
  }

  // Returns appropriate contextual icon per audit action type
  const getActionBadge = (action: string) => {
    switch (action) {
      case "SUBMITTED":
      case "CREATED_AND_SUBMITTED":
        return <FileText className="w-4 h-4 text-blue-600" />
      case "APPROVED_STEP":
      case "STATUS_CHANGE":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      case "REJECTED":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "SUSPENDED":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />
      case "RESUMED":
        return <Clock className="w-4 h-4 text-blue-600" />
      case "CLOSED":
      case "CLOSED_VERIFIED":
        return <Shield className="w-4 h-4 text-emerald-700" />
      case "AUTO_EXPIRED":
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      default:
        return <UserCheck className="w-4 h-4 text-slate-500" />
    }
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {logs.map((log, logIdx) => {
          const isLast = logIdx === logs.length - 1
          return (
            <li key={log.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="relative">
                    <span className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center ring-8 ring-white">
                      {getActionBadge(log.action)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {log.action.replace(/_/g, " ")}{" "}
                        <span className="font-normal text-slate-500">
                          by {log.actor?.name || "System"} ({log.actor?.role || "SYSTEM"})
                        </span>
                      </p>
                      {log.comment && (
                        <p className="mt-1 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                          "{log.comment}"
                        </p>
                      )}
                      {(log.fromValue || log.toValue) && (
                        <p className="mt-0.5 text-[11px] text-slate-500 font-mono">
                          {log.fromValue ? `${log.fromValue} → ` : ""}{log.toValue}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-[11px] whitespace-nowrap text-slate-400">
                      <time dateTime={new Date(log.createdAt).toISOString()}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <br />
                        {new Date(log.createdAt).toLocaleDateString("en-IN")}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
