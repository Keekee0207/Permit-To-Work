"use client"

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
  RotateCw
} from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [permits, setPermits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL")
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [selectedArea, setSelectedArea] = useState<string>("ALL")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [onlyMyPending, setOnlyMyPending] = useState<boolean>(false)
  const [availableAreas, setAvailableAreas] = useState<any[]>([])

  // Real-time tick for countdown
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const loadData = async () => {
    try {
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

      const url = new URL("/api/permits", window.location.origin)
      if (onlyMyPending) {
        url.searchParams.set("pendingMyApproval", "true")
      }
      const res = await fetch(url.toString())
      const data = await res.json()
      setPermits(data.permits || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [onlyMyPending])

  // Computed metrics
  const activePermits = permits.filter((p) => p.status === "ACTIVE")
  
  // Permits expiring within next 2 hours (120 minutes)
  const expiringSoonPermits = permits.filter((p) => {
    if (p.status !== "ACTIVE" && p.status !== "PENDING_APPROVAL") return false
    const end = new Date(p.extendedUntil || p.plannedEnd).getTime()
    const diffHours = (end - now) / (1000 * 60 * 60)
    return diffHours > 0 && diffHours <= 2
  })

  // Filtered list for table
  const filteredPermits = permits.filter((p) => {
    if (selectedStatus !== "ALL" && p.status !== selectedStatus) return false
    if (selectedType !== "ALL" && p.type !== selectedType) return false
    if (selectedArea !== "ALL" && p.areaId !== selectedArea) return false
    if (dateFilter) {
      const pStart = new Date(p.plannedStart).toISOString().slice(0, 10)
      const pEnd = new Date(p.extendedUntil || p.plannedEnd).toISOString().slice(0, 10)
      if (dateFilter < pStart || dateFilter > pEnd) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchNumber = p.permitNumber.toLowerCase().includes(q)
      const matchDesc = p.workDescription.toLowerCase().includes(q)
      const matchArea = p.area?.name?.toLowerCase().includes(q)
      const matchContractor = p.contractorTeam?.toLowerCase().includes(q)
      if (!matchNumber && !matchDesc && !matchArea && !matchContractor) return false
    }
    return true
  })

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

  const formatCountdown = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - now
    if (diff <= 0) return "Expired"
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m left`
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        Loading shop floor permits...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Create */}
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
          <Link
            href="/permits/new"
            className="min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Raise New Permit
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards: What's Active Right Now & What's Expiring Soon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Permits */}
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
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Expiring Soon (< 2 Hours) */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Expiring in Next 2 Hours
            </span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">
              {expiringSoonPermits.length}
            </div>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Requires extension or closure review
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* My Approvals Pending Switcher */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Approvals Filter
            </span>
            <div className="text-sm font-semibold text-slate-800 mt-1">
              Role: <span className="font-mono text-blue-600">{currentUser?.role}</span>
            </div>
          </div>
          <button
            onClick={() => setOnlyMyPending(!onlyMyPending)}
            className={`mt-2 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
              onlyMyPending
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Show "My Approvals Pending"</span>
            <span className={`w-2 h-2 rounded-full ${onlyMyPending ? "bg-white" : "bg-slate-300"}`} />
          </button>
        </div>
      </div>

      {/* Urgent Warning Strip for Expiring Soon */}
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Search by Permit #, contractor, description, or plant area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
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
            className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          />

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
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
            className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CLOSED">Closed</option>
            <option value="CLOSED_VERIFIED">Closed & Verified</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {(selectedStatus !== "ALL" || selectedType !== "ALL" || selectedArea !== "ALL" || dateFilter || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus("ALL")
                setSelectedType("ALL")
                setSelectedArea("ALL")
                setDateFilter("")
                setSearchQuery("")
              }}
              title="Reset all filters"
              className="min-h-[40px] px-2.5 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50/50 rounded-lg hover:bg-red-50"
            >
              Reset
            </button>
          )}

          <button
            onClick={loadData}
            title="Refresh list"
            className="min-h-[40px] px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Permits List Table (Shop-Floor Responsive) */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {filteredPermits.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No permits found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#E5E7EB] text-[#475569] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Permit # & Type</th>
                  <th className="py-3 px-4">Plant & Area</th>
                  <th className="py-3 px-4">Description / Contractor</th>
                  <th className="py-3 px-4">Validity & Schedule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredPermits.map((p) => {
                  const end = new Date(p.extendedUntil || p.plannedEnd).getTime()
                  const diffHours = (end - now) / (1000 * 60 * 60)
                  const isExpiringSoon = (p.status === "ACTIVE" || p.status === "PENDING_APPROVAL") && diffHours > 0 && diffHours <= 2

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded bg-slate-100 border border-slate-200">
                            {getTypeIcon(p.type)}
                          </span>
                          <div>
                            <Link
                              href={`/permits/${p.id}`}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {p.permitNumber}
                            </Link>
                            <div className="text-[10px] text-slate-500 font-sans uppercase">
                              {p.type.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {p.area?.name || "General Area"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.plant?.name} • {p.equipment?.tagCode ? `Tag: ${p.equipment.tagCode}` : "General Area"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="line-clamp-1 font-medium text-slate-800" title={p.workDescription}>
                          {p.workDescription}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Team: <span className="text-slate-700">{p.contractorTeam}</span> (by {p.requester?.name})
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">
                          {new Date(p.plannedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(p.extendedUntil || p.plannedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          {new Date(p.plannedStart).toLocaleDateString("en-IN")}
                          {isExpiringSoon && (
                            <span className="text-amber-700 font-semibold bg-amber-50 px-1 rounded border border-amber-200">
                              ⏱ {formatCountdown(p.extendedUntil || p.plannedEnd)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={p.status} />
                          {isExpiringSoon && (
                            <span className="text-[10px] text-amber-700 font-bold tracking-tight">
                              EXPIRING SOON
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/permits/${p.id}`}
                          className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg transition"
                        >
                          View Details
                          <ArrowRight className="w-3.5 h-3.5" />
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
