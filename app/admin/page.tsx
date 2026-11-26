"use client"

/**
 * ============================================================================
 * ADMIN CONTROL PANEL (PLANTS, ZONES, ASSETS & USERS)
 * ============================================================================
 * Restricted solely to system Administrators:
 * 1. Facility Setup: Create and manage Plants (e.g. Chennai, Sriperumbudur).
 * 2. Area Hierarchy: Partition plants into physical areas/zones.
 * 3. Asset Registry: Add plant machinery and equipment tag codes.
 * 4. User Directory: Manage users and assign Area Owners to plant zones.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Plus, Building2, MapPin, Wrench, Users, AlertTriangle } from "lucide-react"

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plants, setPlants] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  // Form states
  const [activeTab, setActiveTab] = useState<"PLANTS" | "AREAS" | "EQUIPMENT" | "USERS">("PLANTS")

  // New Plant Form
  const [plantName, setPlantName] = useState("")
  const [plantCode, setPlantCode] = useState("")
  const [plantLocation, setPlantLocation] = useState("")

  // New Area Form
  const [areaName, setAreaName] = useState("")
  const [areaCode, setAreaCode] = useState("")
  const [areaPlantId, setAreaPlantId] = useState("")

  // New Equipment Form
  const [eqName, setEqName] = useState("")
  const [eqTag, setEqTag] = useState("")
  const [eqAreaId, setEqAreaId] = useState("")
  const [eqDesc, setEqDesc] = useState("")

  // New User Form
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userRole, setUserRole] = useState("REQUESTER")
  const [userPassword, setUserPassword] = useState("Password@123")

  const loadData = async () => {
    try {
      const [uRes, aRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()),
        fetch("/api/admin").then((r) => r.json()),
      ])

      if (!uRes.user) {
        router.push("/login")
        return
      }

      if (uRes.user.role !== "ADMIN") {
        router.push("/")
        return
      }

      setCurrentUser(uRes.user)
      setPlants(aRes.plants || [])
      setAreas(aRes.areas || [])
      setEquipment(aRes.equipment || [])
      setUsers(aRes.users || [])

      if (aRes.plants?.length > 0) {
        setAreaPlantId(aRes.plants[0].id)
      }
      if (aRes.areas?.length > 0) {
        setEqAreaId(aRes.areas[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (resourceType: string, data: any) => {
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, data }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || "Failed to create resource")
      } else {
        setMessage(`${resourceType} successfully added!`)
        loadData()
      }
    } catch (err: any) {
      setError("Network error")
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading admin dashboard...</div>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              CMMS Administration & Facility Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage Indian plants, operational areas, equipment tag codes, and user role authorizations.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
            {message}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-6 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("PLANTS")}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "PLANTS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" /> Plants ({plants.length})
          </button>
          <button
            onClick={() => setActiveTab("AREAS")}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "AREAS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" /> Areas ({areas.length})
          </button>
          <button
            onClick={() => setActiveTab("EQUIPMENT")}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "EQUIPMENT" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench className="w-4 h-4" /> Equipment ({equipment.length})
          </button>
          <button
            onClick={() => setActiveTab("USERS")}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "USERS" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" /> Users & Roles ({users.length})
          </button>
        </div>

        {/* TAB 1: PLANTS */}
        {activeTab === "PLANTS" && (
          <div className="pt-6 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Register New Industrial Plant
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Plant Name (e.g. Pune Assembly Facility)"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Plant Code (e.g. PN-01)"
                  value={plantCode}
                  onChange={(e) => setPlantCode(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs uppercase"
                />
                <input
                  type="text"
                  placeholder="Location (e.g. Chakan, Pune, Maharashtra)"
                  value={plantLocation}
                  onChange={(e) => setPlantLocation(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (plantName && plantCode && plantLocation) {
                    handleCreate("PLANT", { name: plantName, code: plantCode, location: plantLocation })
                    setPlantName("")
                    setPlantCode("")
                    setPlantLocation("")
                  }
                }}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Plant
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Plant Name</th>
                    <th className="py-2.5 px-4">Location</th>
                    <th className="py-2.5 px-4">Configured Areas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {plants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.location}</td>
                      <td className="py-3 px-4 text-slate-600">{p.areas?.length || 0} areas</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: AREAS */}
        {activeTab === "AREAS" && (
          <div className="pt-6 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Register New Plant Area
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={areaPlantId}
                  onChange={(e) => setAreaPlantId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Area Name (e.g. Paint Shop Oven Line)"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Area Code (e.g. PNT-01)"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (areaName && areaCode && areaPlantId) {
                    handleCreate("AREA", { name: areaName, code: areaCode, plantId: areaPlantId })
                    setAreaName("")
                    setAreaCode("")
                  }
                }}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Area
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Area Name</th>
                    <th className="py-2.5 px-4">Plant</th>
                    <th className="py-2.5 px-4">Assigned Area Owners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {areas.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{a.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{a.name}</td>
                      <td className="py-3 px-4 text-slate-600">{a.plant?.name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {a.assignedUsers?.length > 0
                          ? a.assignedUsers.map((u: any) => u.user?.name).join(", ")
                          : "None assigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EQUIPMENT */}
        {activeTab === "EQUIPMENT" && (
          <div className="pt-6 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Register Equipment Tag Code
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={eqAreaId}
                  onChange={(e) => setEqAreaId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Tag Code (e.g. BLR-01-A)"
                  value={eqTag}
                  onChange={(e) => setEqTag(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase"
                />
                <input
                  type="text"
                  placeholder="Equipment Name"
                  value={eqName}
                  onChange={(e) => setEqName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={eqDesc}
                  onChange={(e) => setEqDesc(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (eqTag && eqName && eqAreaId) {
                    handleCreate("EQUIPMENT", { tagCode: eqTag, name: eqName, areaId: eqAreaId, description: eqDesc })
                    setEqTag("")
                    setEqName("")
                    setEqDesc("")
                  }
                }}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Equipment
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Tag Code</th>
                    <th className="py-2.5 px-4">Equipment Name</th>
                    <th className="py-2.5 px-4">Area & Plant</th>
                    <th className="py-2.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {equipment.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{eq.tagCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{eq.name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {eq.area?.name} ({eq.area?.plant?.name})
                      </td>
                      <td className="py-3 px-4 text-slate-500">{eq.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: USERS */}
        {activeTab === "USERS" && (
          <div className="pt-6 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Create User Account
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="REQUESTER">REQUESTER</option>
                  <option value="AREA_OWNER">AREA_OWNER</option>
                  <option value="SAFETY_OFFICER">SAFETY_OFFICER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <input
                  type="password"
                  placeholder="Default Password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (userName && userEmail && userRole) {
                    handleCreate("USER", {
                      name: userName,
                      email: userEmail,
                      role: userRole,
                      password: userPassword,
                    })
                    setUserName("")
                    setUserEmail("")
                  }
                }}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">User Name</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">System Role</th>
                    <th className="py-2.5 px-4">Assigned Plant Areas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {u.assignedAreas?.length > 0
                          ? u.assignedAreas.map((ua: any) => ua.area?.name).join(", ")
                          : "All / Unrestricted"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
