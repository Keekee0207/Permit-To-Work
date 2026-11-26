/**
 * ============================================================================
 * PERMIT STATUS BADGE COMPONENT
 * ============================================================================
 * Visual indicator providing high-contrast, standardized industrial colors
 * for each lifecycle state (DRAFT, PENDING, ACTIVE, SUSPENDED, EXPIRED, etc.).
 */

import { PermitStatus } from "@prisma/client"

export function StatusBadge({ status }: { status: PermitStatus | string }) {
  let colorStyles = "text-[#475569] bg-[#F1F5F9] border-slate-200"

  switch (status) {
    case "ACTIVE":
    case "CLOSED_VERIFIED":
      // Safe, compliant states (Green)
      colorStyles = "text-[#059669] bg-[#ECFDF5] border-emerald-200"
      break
    case "PENDING_APPROVAL":
    case "EXPIRING_SOON":
    case "SUSPENDED":
      // Action required / warning states (Amber)
      colorStyles = "text-[#D97706] bg-[#FFFBEB] border-amber-200"
      break
    case "REJECTED":
    case "EXPIRED":
    case "CONFLICT WARNING":
      // High-risk / critical stop states (Red)
      colorStyles = "text-[#DC2626] bg-[#FEF2F2] border-red-200"
      break
    case "DRAFT":
    case "CLOSED":
    case "CANCELLED":
    default:
      // Neutral states (Slate / Gray)
      colorStyles = "text-[#475569] bg-[#F1F5F9] border-slate-200"
      break
  }

  const formatText = (text: string) => text.replace(/_/g, " ")

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase ${colorStyles}`}
    >
      {formatText(status)}
    </span>
  )
}
