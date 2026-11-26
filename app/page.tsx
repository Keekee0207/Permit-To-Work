"use client"

/**
 * ============================================================================
 * SHOP-FLOOR PERMIT CONTROL BOARD (MAIN DASHBOARD)
 * ============================================================================
 * This is the central control screen of the Permit to Work (PTW) system.
 * Key capabilities:
 * 1. Real-time Compliance Monitoring (Active permits, pending approvals, expiry countdowns).
 * 2. Role-Based Actions (Area Owner & Safety Officer pending approval filters).
 * 3. Quick 4 Permit Type Navigation Tabs with dynamic live count badges.
 * 4. Multi-Criteria Filtering (Search text, plant area, date range, type, status).
 * 5. Flexible Sorting (Sort by the 4 permit types, newest, soonest expiry, status).
 * 6. High-Visibility Green Alerts for saved drafts, submitted permits, and approvals.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StatusBadge } from "@/components/StatusBadge"
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Search, 
  Filter, 
  ArrowRight, 
  Flame, 
  Box, 
  ArrowUpRight, 
  Zap,
  RotateCw,
  ArrowUpDown,
  FileText,
  ShieldCheck
} from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Master list of all permits visible to the logged-in user
  const [permits, setPermits] = useState<any[]>([])
  // Page loading indicator
  const [loading, setLoading] = useState(true)
  // Current authenticated user session (role, id, name, assigned areas)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Active Filter States
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL")
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [selectedArea, setSelectedArea] = useState<string>("ALL")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("NEWEST")
  const [onlyMyPending, setOnlyMyPending] = useState<boolean>(false)
  const [availableAreas, setAvailableAreas] = useState<any[]>([])

  // High-visibility green notification banner (triggered after saving draft or submitting permit)
  const [notification, setNotification] = useState<{
    type: "draft" | "submitted"
    title: string
    description: string
  } | null>(null)

  // Real-time timestamp (updates every 15s to recalculate countdown timers)
  const [now, setNow] = useState<number>(Date.now())

  // --------------------------------------------------------------------------
  // 1. URL NOTIFICATION HANDLER
  // --------------------------------------------------------------------------
  // Checks if user was redirected from the permit form after saving or submitting.
  // Displays a green toast banner and cleanly removes query parameters from the URL.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const notify = params.get("notify")
      const num = params.get("num") || ""

      if (notify === "draft_saved") {
        setNotification({
          type: "draft",
          title: "Draft Saved Successfully!",
          description: num
            ? `Permit draft (${num}) has been saved. Only you can view, edit, or submit this draft from your dashboard.`
            : "Your permit draft has been saved. Only you can view, edit, or submit this draft from your dashboard.",
        })
        window.history.replaceState({}, "", window.location.pathname)
      } else if (notify === "submitted") {
        setNotification({
          type: "submitted",
          title: "Permit Form Submitted Successfully!",
          description: num
            ? `Permit (${num}) has been successfully submitted for approval. It is now routed to the Area Owner and Safety Officer for sign-off.`
            : "Your permit form has been successfully submitted for approval. It is now routed to the Area Owner and Safety Officer for sign-off.",
        })
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [])

  // --------------------------------------------------------------------------
  // 2. REAL-TIME TICKER
  // --------------------------------------------------------------------------
  // Ticks every 15 seconds to update permit validity countdowns in real time
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  // --------------------------------------------------------------------------
  // 3. DATA FETCHING (USER, PLANTS, PERMITS)
  // --------------------------------------------------------------------------
  const loadData = async () => {
    try {
      // Fetch authenticated user profile & plant hierarchy in parallel
      const [userRes, plantsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/plants"),
      ])
      const userData = await userRes.json()
      if (!userData.user) {
        router.push("/login")
        return
      }
      setCurrentUser(userData.user)

      // Flatten plants and their sub-areas for the Area Filter dropdown
      const plantsData = await plantsRes.json()
      const areasList: any[] = []
      if (plantsData.plants) {
        plantsData.plants.forEach((pl: any) => {
          if (pl.areas) {
            pl.areas.forEach((a: any) => areasList.push({ ...a, plantName: pl.name }))
          }
        })
      }
      setAvailableAreas(areasList)

      // Fetch visible permits (respecting role-based privacy rules on backend)
      const res = await fetch("/api/permits")
      const data = await res.json()
      setPermits(data.permits || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Load initial data on mount
  useEffect(() => {
    loadData()
  }, [])

  // --------------------------------------------------------------------------
  // 4. COMPUTED METRICS FOR DASHBOARD CARDS
  // --------------------------------------------------------------------------
  // All permits currently undergoing live execution on site
  const activePermits = permits.filter((p) => p.status === "ACTIVE")

  // All permits waiting for Area Owner or Safety Officer approvals
  const pendingApprovals = permits.filter((p) => p.status === "PENDING_APPROVAL")
  
  // Count of drafts for the current user
  const draftsCount = permits.filter((p) => p.status === "DRAFT").length

  // Count of permits specifically awaiting this user's approval
  const myPendingApprovalsCount = permits.filter((p) => {
    if (p.status !== "PENDING_APPROVAL") return false
    if (currentUser?.role === "AREA_OWNER") {
      const aoApp = p.approvals?.find((a: any) => a.requiredRole === "AREA_OWNER")
      return aoApp?.decision === "PENDING"
    }
    if (currentUser?.role === "SAFETY_OFFICER") {
      const soApp = p.approvals?.find((a: any) => a.requiredRole === "SAFETY_OFFICER")
      return soApp?.decision === "PENDING"
    }
    return false
  }).length

  // Permits expiring in under 2 hours (120 minutes) that need extension or closure
  const expiringSoonPermits = permits.filter((p) => {
    if (p.status !== "ACTIVE" && p.status !== "PENDING_APPROVAL") return false
    const end = new Date(p.extendedUntil || p.plannedEnd).getTime()
    const diffHours = (end - now) / (1000 * 60 * 60)
    return diffHours > 0 && diffHours <= 2
  })

  // --------------------------------------------------------------------------
  // 5. IN-MEMORY FILTERING & DYNAMIC SEARCH
  // --------------------------------------------------------------------------
  // Step 5A: Filters matching search keywords, area, date, and status (before type filter)
  // This allows the 4 Type Navigation Pills to show exact matching counts for the current search query!
  const baseSearchedPermits = permits.filter((p) => {
    // Filter 0: Role-Specific Action Filter (My Pending Approvals)
    if (onlyMyPending) {
      if (p.status !== "PENDING_APPROVAL") return false
      if (currentUser?.role === "AREA_OWNER") {
        const aoApp = p.approvals?.find((a: any) => a.requiredRole === "AREA_OWNER")
        if (aoApp?.decision !== "PENDING") return false
      }
      if (currentUser?.role === "SAFETY_OFFICER") {
        const soApp = p.approvals?.find((a: any) => a.requiredRole === "SAFETY_OFFICER")
        if (soApp?.decision !== "PENDING") return false
      }
    }

    // Filter 1: Status Filter (including private drafts for requesters)
    if (selectedStatus !== "ALL") {
      if (selectedStatus === "DRAFT") {
        if (p.status !== "DRAFT") return false
      } else if (p.status !== selectedStatus) {
        return false
      }
    }

    // Filter 2: Plant Area Filter
    if (selectedArea !== "ALL" && p.areaId !== selectedArea) return false

    // Filter 3: Date Filter (checks if the selected date falls within the planned work window)
    if (dateFilter) {
      try {
        const selectedDateStr = dateFilter
        const pStartStr = new Date(p.plannedStart).toISOString().slice(0, 10)
        const pEndStr = new Date(p.extendedUntil || p.plannedEnd).toISOString().slice(0, 10)
        if (selectedDateStr < pStartStr || selectedDateStr > pEndStr) return false
      } catch (e) {
        // Fallback if date string cannot be parsed
      }
    }

    // Filter 4: Text Search Query (Case-insensitive across permit #, description, area, contractor, equipment, and requester)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchNumber = p.permitNumber?.toLowerCase().includes(q)
      const matchDesc = p.workDescription?.toLowerCase().includes(q)
      const matchArea = p.area?.name?.toLowerCase().includes(q)
      const matchContractor = p.contractorTeam?.toLowerCase().includes(q)
      const matchEquipment = p.equipment?.name?.toLowerCase().includes(q) || p.equipment?.tagCode?.toLowerCase().includes(q)
      const matchRequester = p.requester?.name?.toLowerCase().includes(q)
      if (!matchNumber && !matchDesc && !matchArea && !matchContractor && !matchEquipment && !matchRequester) {
        return false
      }
    }

    return true
  })

  // Step 5B: Filter by the 4 Permit Types (Hot Work, Confined Space, Height Work, Electrical LOTO)
  const filteredPermits = baseSearchedPermits.filter((p) => {
    if (selectedType !== "ALL" && p.type !== selectedType) return false
    return true
  })

  // --------------------------------------------------------------------------
  // 6. MULTI-CRITERIA SORTING LOGIC
  // --------------------------------------------------------------------------
  // Canonical industrial order for grouping the 4 permit types
  const typeOrder: Record<string, number> = {
    HOT_WORK: 1,
    CONFINED_SPACE: 2,
    WORKING_AT_HEIGHT: 3,
    ELECTRICAL_LOTO: 4,
  }

  // Sorted permit list ready for table display
  const sortedAndFilteredPermits = [...filteredPermits].sort((a, b) => {
    // Sort Option A: Group by Permit Type (Hot Work -> Confined Space -> Height -> Electrical)
    if (sortBy === "TYPE_ASC") {
      const orderA = typeOrder[a.type] || 99
      const orderB = typeOrder[b.type] || 99
      if (orderA !== orderB) return orderA - orderB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    // Sort Option B: Reverse Permit Type Order (Electrical -> Height -> Confined -> Hot)
    if (sortBy === "TYPE_DESC") {
      const orderA = typeOrder[a.type] || 99
      const orderB = typeOrder[b.type] || 99
      if (orderA !== orderB) return orderB - orderA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    // Sort Option C: Soonest Expiring First
    if (sortBy === "EXPIRING") {
      const endA = new Date(a.extendedUntil || a.plannedEnd).getTime()
      const endB = new Date(b.extendedUntil || b.plannedEnd).getTime()
      return endA - endB
    }
    // Sort Option D: Alphabetical by Status
    if (sortBy === "STATUS") {
      return a.status.localeCompare(b.status)
    }
    // Default: Newest Created Permits First
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // --------------------------------------------------------------------------
  // 7. HELPER FUNCTIONS
  // --------------------------------------------------------------------------
  // Returns color-coded icons for each of the 4 permit types
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "HOT_WORK":
        return <Flame className="w-4 h-4 text-amber-600" />
      case "CONFINED_SPACE":
        return <Box className="w-4 h-4 text-purple-600" />
      case "WORKING_AT_HEIGHT":
        return <ArrowUpRight className="w-4 h-4 text-blue-600" />
      case "ELECTRICAL_LOTO":
        return <Zap className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  // Calculates and formats human-readable remaining time until permit expires
  const formatCountdown = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - now
    if (diff <= 0) return "Expired"
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m left`
  }

  // --------------------------------------------------------------------------
  // 8. LOADING STATE SKELETON
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        Loading shop floor permits...
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // 9. MAIN DASHBOARD RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9A: SUCCESS NOTIFICATION BANNER (HIGH VISIBILITY GREEN)       */}
      {/* Displays when user saves draft or submits permit from the form        */}
      {/* -------------------------------------------------------------------- */}
      {notification && (
        <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/95 text-emerald-950 shadow-sm flex items-start justify-between transition-all duration-300">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-900 font-mono">
                  Success
                </span>
                <h3 className="text-sm font-bold text-emerald-950">{notification.title}</h3>
              </div>
              <p className="text-xs text-emerald-900 mt-1 font-medium leading-relaxed">
                {notification.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-md text-emerald-700 hover:text-emerald-950 hover:bg-emerald-200/50 transition text-sm font-bold ml-2"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9B: SHOP-FLOOR HEADER & "RAISE NEW PERMIT" PRIMARY CTA        */}
      {/* Requesters & Admins see the primary button to create a new permit     */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              Shop-Floor Permit Control Board
            </h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              Live
            </span>
          </div>
          <p className="text-xs text-[#475569] mt-0.5">
            Real-time compliance monitoring for Chennai & Sriperumbudur industrial facilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(currentUser?.role === "REQUESTER" || currentUser?.role === "ADMIN") && (
            <Link
              href="/permits/new"
              className="min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Raise New Permit
            </Link>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9C: OVERVIEW METRIC CARDS                                     */}
      {/* Active Work, Expirations within 2h, Pending Approvals, & Role Action */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1: Active Permits Currently On Site */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active Right Now
            </span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
              {activePermits.length}
            </div>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Permits currently executing on site
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 2: Permits Expiring Soon (< 2 Hours) */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Expiring in 2 Hours
            </span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
              {expiringSoonPermits.length}
            </div>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Requires extension or closure review
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 3: Interactive Pending Approval Filter Card */}
        <div 
          onClick={() => {
            setOnlyMyPending(false)
            setSelectedStatus(selectedStatus === "PENDING_APPROVAL" && !onlyMyPending ? "ALL" : "PENDING_APPROVAL")
          }}
          className={`bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer transition hover:border-blue-400 ${
            selectedStatus === "PENDING_APPROVAL" && !onlyMyPending ? "ring-2 ring-blue-600 bg-blue-50/30" : ""
          }`}
          title="Click to filter table by Pending Approval"
        >
          <div>
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Pending Approvals
            </span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
              {pendingApprovals.length}
            </div>
            <p className="text-[11px] text-[#475569] mt-0.5">
              {selectedStatus === "PENDING_APPROVAL" && !onlyMyPending ? "Click to clear filter" : "Click to view in table"}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Filter className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 4: Role-Adaptive Card (My Pending Approvals for Approvers, or My Drafts for Requesters/Admins) */}
        {currentUser?.role === "AREA_OWNER" || currentUser?.role === "SAFETY_OFFICER" ? (
          <div 
            onClick={() => {
              if (onlyMyPending) {
                setOnlyMyPending(false)
                setSelectedStatus("ALL")
              } else {
                setOnlyMyPending(true)
                setSelectedStatus("PENDING_APPROVAL")
              }
            }}
            className={`bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer transition hover:border-purple-400 ${
              onlyMyPending ? "ring-2 ring-purple-600 bg-purple-50/40" : ""
            }`}
            title="Click to filter permits specifically requiring your signature"
          >
            <div>
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                My Action Items
              </span>
              <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
                {myPendingApprovalsCount}
              </div>
              <p className="text-[11px] text-[#475569] mt-0.5">
                {onlyMyPending ? "Showing your approvals" : "Requiring your signature"}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setSelectedStatus(selectedStatus === "DRAFT" ? "ALL" : "DRAFT")}
            className={`bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between cursor-pointer transition hover:border-slate-400 ${
              selectedStatus === "DRAFT" ? "ring-2 ring-slate-600 bg-slate-50" : ""
            }`}
            title="Click to filter table by Drafts"
          >
            <div>
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                My Drafts
              </span>
              <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
                {draftsCount}
              </div>
              <p className="text-[11px] text-[#475569] mt-0.5">
                {selectedStatus === "DRAFT" ? "Click to clear filter" : "Unsubmitted work drafts"}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9D: URGENT EXPIRY WARNING STRIP                              */}
      {/* Lists exact permit numbers approaching mandatory auto-suspension     */}
      {/* -------------------------------------------------------------------- */}
      {expiringSoonPermits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Attention Required: {expiringSoonPermits.length} Permit(s) Expiring Soon
              </div>
              <div className="text-xs text-amber-800">
                {expiringSoonPermits.map((p) => (
                  <span key={p.id} className="mr-3 font-medium">
                    {p.permitNumber} ({formatCountdown(p.extendedUntil || p.plannedEnd)})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-amber-700 font-medium">
            Extend or initiate safe closure before auto-expiry.
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9E: QUICK 4 PERMIT TYPE NAVIGATION PILLS                     */}
      {/* All Permits | Hot Work | Confined Space | Height Work | Electrical   */}
      {/* Shows live dynamic match count badges while typing in search bar     */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "ALL", label: "All Permits", icon: null, count: baseSearchedPermits.length },
          { id: "HOT_WORK", label: "Hot Work", icon: Flame, count: baseSearchedPermits.filter(p => p.type === "HOT_WORK").length, activeColor: "bg-amber-600 text-white border-amber-600" },
          { id: "CONFINED_SPACE", label: "Confined Space", icon: Box, count: baseSearchedPermits.filter(p => p.type === "CONFINED_SPACE").length, activeColor: "bg-purple-600 text-white border-purple-600" },
          { id: "WORKING_AT_HEIGHT", label: "Height Work", icon: ArrowUpRight, count: baseSearchedPermits.filter(p => p.type === "WORKING_AT_HEIGHT").length, activeColor: "bg-blue-600 text-white border-blue-600" },
          { id: "ELECTRICAL_LOTO", label: "Electrical LOTO", icon: Zap, count: baseSearchedPermits.filter(p => p.type === "ELECTRICAL_LOTO").length, activeColor: "bg-red-600 text-white border-red-600" },
        ].map((tab) => {
          const isSelected = selectedType === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition shrink-0 shadow-xs ${
                isSelected
                  ? tab.activeColor || "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-500"}`} />}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9F: MULTI-CRITERIA FILTER & SEARCH TOOLBAR                   */}
      {/* Search Input, Sort Dropdown, Area, Date, Type, Status, Reset/Refresh */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px] bg-slate-50 border border-slate-200 rounded-lg px-3 min-h-[40px] focus-within:border-blue-600 focus-within:bg-white transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by Permit #, contractor, description, or plant area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort permits"
              className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="NEWEST">Sort: Newest First</option>
              <option value="TYPE_ASC">Sort: Permit Type (Hot → Confined → Height → LOTO)</option>
              <option value="TYPE_DESC">Sort: Permit Type (LOTO → Height → Confined → Hot)</option>
              <option value="EXPIRING">Sort: Expiring Soonest</option>
              <option value="STATUS">Sort: By Status</option>
            </select>
          </div>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Areas</option>
            {availableAreas.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by active date"
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          />

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Types</option>
            <option value="HOT_WORK">Hot Work</option>
            <option value="CONFINED_SPACE">Confined Space</option>
            <option value="WORKING_AT_HEIGHT">Working at Height</option>
            <option value="ELECTRICAL_LOTO">Electrical LOTO</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            {currentUser?.role === "REQUESTER" && (
              <option value="DRAFT">My Drafts</option>
            )}
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CLOSED">Closed</option>
            <option value="CLOSED_VERIFIED">Closed & Verified</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {(selectedStatus !== "ALL" || selectedType !== "ALL" || selectedArea !== "ALL" || dateFilter || searchQuery || sortBy !== "NEWEST") && (
            <button
              onClick={() => {
                setSelectedStatus("ALL")
                setSelectedType("ALL")
                setSelectedArea("ALL")
                setDateFilter("")
                setSearchQuery("")
                setSortBy("NEWEST")
                setOnlyMyPending(false)
              }}
              title="Reset all filters and sorting"
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-red-50/70 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
            >
              Reset
            </button>
          )}

          <button
            onClick={loadData}
            title="Refresh list"
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 9G: SHOP-FLOOR RESPONSIVE DATA TABLE                         */}
      {/* Interactive sortable headers, type badges, countdown, and actions    */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {sortedAndFilteredPermits.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No permits found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-[#E5E7EB] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  {/* Column 1: Clickable Sort by Permit Type */}
                  <th
                    className="py-3.5 px-4 text-left cursor-pointer hover:bg-slate-100 transition select-none group"
                    onClick={() => {
                      if (sortBy === "TYPE_ASC") setSortBy("TYPE_DESC")
                      else if (sortBy === "TYPE_DESC") setSortBy("NEWEST")
                      else setSortBy("TYPE_ASC")
                    }}
                    title="Click to sort by Permit Type"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Permit # & Type</span>
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortBy.startsWith("TYPE") ? "text-blue-600 font-bold" : "text-slate-400 opacity-60 group-hover:opacity-100"}`} />
                      {sortBy === "TYPE_ASC" && <span className="text-[10px] text-blue-600 font-mono font-normal">Hot→LOTO</span>}
                      {sortBy === "TYPE_DESC" && <span className="text-[10px] text-blue-600 font-mono font-normal">LOTO→Hot</span>}
                    </div>
                  </th>

                  {/* Column 2: Facility Plant & Sub-Area */}
                  <th className="py-3.5 px-4 text-left">Plant & Area</th>

                  {/* Column 3: Work Description & Assigned Contractor */}
                  <th className="py-3.5 px-4 text-left">Description / Contractor</th>

                  {/* Column 4: Time Schedule & Real-time Expiry Countdown */}
                  <th className="py-3.5 px-4 text-left">Validity & Schedule</th>

                  {/* Column 5: Current Permit Status */}
                  <th className="py-3.5 px-4 text-left">Status</th>

                  {/* Column 6: Action Button */}
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {sortedAndFilteredPermits.map((p) => {
                  // Calculate time remaining until planned work window closes
                  const end = new Date(p.extendedUntil || p.plannedEnd).getTime()
                  const diffHours = (end - now) / (1000 * 60 * 60)
                  const isExpiringSoon = (p.status === "ACTIVE" || p.status === "PENDING_APPROVAL") && diffHours > 0 && diffHours <= 2

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Permit Number & Colored Type Icon */}
                      <td className="py-3.5 px-4 align-middle text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
                            {getTypeIcon(p.type)}
                          </span>
                          <div>
                            <Link
                              href={`/permits/${p.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-mono font-bold text-xs"
                            >
                              {p.permitNumber}
                            </Link>
                            <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">
                              {p.type.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plant and specific area tag */}
                      <td className="py-3.5 px-4 align-middle text-slate-700">
                        <div className="font-semibold text-slate-900 text-xs">
                          {p.area?.name || "General Area"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.plant?.name} • {p.equipment?.tagCode ? `Tag: ${p.equipment.tagCode}` : "General Area"}
                        </div>
                      </td>

                      {/* Work description and contractor */}
                      <td className="py-3.5 px-4 align-middle max-w-xs">
                        <div className="line-clamp-1 font-medium text-slate-800 text-xs" title={p.workDescription}>
                          {p.workDescription}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Team: <span className="text-slate-700 font-medium">{p.contractorTeam}</span> (by {p.requester?.name})
                        </div>
                      </td>

                      {/* Work validity schedule and countdown */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="text-slate-800 font-medium text-xs">
                          {new Date(p.plannedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {new Date(p.extendedUntil || p.plannedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{new Date(p.plannedStart).toLocaleDateString("en-IN")}</span>
                          {isExpiringSoon && (
                            <span className="text-amber-800 font-bold bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[10px]">
                              ⏱ {formatCountdown(p.extendedUntil || p.plannedEnd)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={p.status} />
                          {isExpiringSoon && (
                            <span className="text-[10px] text-amber-700 font-bold uppercase tracking-tight">
                              Expiring Soon
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action link to details: Fully Visible in Deep Blue */}
                      <td className="py-3.5 px-4 text-right align-middle">
                        <Link
                          href={`/permits/${p.id}`}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg shadow-sm transition-all whitespace-nowrap"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
