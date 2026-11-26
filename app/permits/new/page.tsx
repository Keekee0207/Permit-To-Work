"use client"

/**
 * ============================================================================
 * PERMIT TO WORK CREATION & DRAFT EDITOR WORKFLOW
 * ============================================================================
 * Allows Requesters and Admins to raise compliant industrial work permits:
 * 1. Role Verification: Restricted exclusively to REQUESTER and ADMIN roles.
 * 2. Type-Specific Configs: Automatically populates safety fields, hazards,
 *    and checklists for Hot Work, Confined Space, Height Work, and Electrical LOTO.
 * 3. Simultaneous Operations (SIMOPS) Conflict Detection: Real-time API check
 *    for overlapping permits on the same plant equipment or area.
 * 4. Flexible Completion: "Save as Draft" (private to requester) or "Submit for Approval".
 * 5. Dashboard Feedback: Returns to dashboard with high-visibility green confirmation.
 */

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PERMIT_TYPE_REGISTRY, PermitTypeDefinition } from "@/lib/permitTypeConfig"
import { PermitType } from "@prisma/client"
import { 
  ShieldAlert, 
  ArrowLeft, 
  Save, 
  Send, 
  CheckSquare, 
  AlertTriangle, 
  Info, 
  Calendar, 
  Building2, 
  HardHat, 
  Eye,
  RotateCw
} from "lucide-react"

function PermitFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // If editing an existing private draft, draft ID is passed via URL query
  const editDraftId = searchParams.get("editDraftId")
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [plants, setPlants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingDraft, setIsEditingDraft] = useState(false)

  // --------------------------------------------------------------------------
  // CORE PERMIT FORM STATES
  // --------------------------------------------------------------------------
  const [selectedType, setSelectedType] = useState<PermitType>("HOT_WORK")
  const [plantId, setPlantId] = useState("")
  const [areaId, setAreaId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [contractorTeam, setContractorTeam] = useState("Alpha Mechanical Contractors Pvt Ltd")
  const [workDescription, setWorkDescription] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")

  // Default dates: today 09:00 to 17:00 IST
  const todayStr = new Date().toISOString().slice(0, 10)
  const [plannedStart, setPlannedStart] = useState(`${todayStr}T09:00`)
  const [plannedEnd, setPlannedEnd] = useState(`${todayStr}T17:00`)

  // Checklists, hazards, and required PPE
  const [hazards, setHazards] = useState<string[]>([])
  const [ppeRequired, setPpeRequired] = useState<string[]>([])
  const [precautions, setPrecautions] = useState<{ id: string; label: string; checked: boolean }[]>([])

  // Dynamic type-specific fields (e.g. gas tests, fire watch, isolation tags, harness check)
  const [typeData, setTypeData] = useState<Record<string, any>>({})

  // SIMOPS Conflicts and validation state
  const [conflicts, setConflicts] = useState<any[]>([])
  const [checkingConflict, setCheckingConflict] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [draftSavedToast, setDraftSavedToast] = useState(false)

  // Active Type Configuration from the central registry
  const currentConfig: PermitTypeDefinition = PERMIT_TYPE_REGISTRY[selectedType]

  // Initialize defaults on type switch
  useEffect(() => {
    if (currentConfig) {
      setHazards([...currentConfig.standardHazards])
      setPpeRequired([...currentConfig.standardPpe])
      setPrecautions(
        currentConfig.standardPrecautions.map((p) => ({
          id: p.id,
          label: p.label,
          checked: p.defaultChecked ?? true,
        }))
      )

      // Initialize default field values
      const initialTypeData: Record<string, any> = {}
      currentConfig.fields.forEach((f) => {
        if (f.defaultValue !== undefined) {
          initialTypeData[f.name] = f.defaultValue
        } else if (f.type === "datetime-local") {
          initialTypeData[f.name] = `${todayStr}T08:30`
        } else if (f.type === "boolean") {
          initialTypeData[f.name] = true
        } else {
          initialTypeData[f.name] = ""
        }
      })
      setTypeData(initialTypeData)
    }
  }, [selectedType])

  // Load plants hierarchy and current user
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => res.json()),
      fetch("/api/plants").then((res) => res.json()),
    ])
      .then(([userData, plantData]) => {
        if (!userData.user) {
          router.push("/login")
          return
        }
        
        // Safety check: Area Owners and Safety Officers are not allowed to create permits
        if (userData.user.role !== "REQUESTER" && userData.user.role !== "ADMIN") {
          router.push("/")
          return
        }

        setCurrentUser(userData.user)

        const plantList = plantData.plants || []
        setPlants(plantList)
        if (plantList.length > 0) {
          setPlantId(plantList[0].id)
          if (plantList[0].areas.length > 0) {
            setAreaId(plantList[0].areas[0].id)
          }
        }

        // If editing a draft, load the existing draft values
        if (editDraftId) {
          fetch(`/api/permits/${editDraftId}`)
            .then((r) => r.json())
            .then((pData) => {
              if (pData.permit && pData.permit.status === "DRAFT") {
                const p = pData.permit
                setIsEditingDraft(true)
                setSelectedType(p.type)
                setPlantId(p.plantId)
                setAreaId(p.areaId)
                setEquipmentId(p.equipmentId || "")
                setContractorTeam(p.contractorTeam || "")
                setWorkDescription(p.workDescription || "")
                setPhotoUrl(p.photoUrl || "")
                if (p.plannedStart) setPlannedStart(new Date(p.plannedStart).toISOString().slice(0, 16))
                if (p.plannedEnd) setPlannedEnd(new Date(p.plannedEnd).toISOString().slice(0, 16))
                if (Array.isArray(p.hazards)) setHazards(p.hazards)
                if (Array.isArray(p.ppeRequired)) setPpeRequired(p.ppeRequired)
                if (Array.isArray(p.precautionsChecklist)) setPrecautions(p.precautionsChecklist)
                if (p.typeSpecificData) setTypeData(p.typeSpecificData)
              }
            })
            .catch(() => {})
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  // Auto conflict checking when type, area, plannedStart or plannedEnd changes
  useEffect(() => {
    if (!areaId || !plannedStart || !plannedEnd) return

    setCheckingConflict(true)
    fetch("/api/permits/check-conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: selectedType,
        plantId,
        areaId,
        plannedStart,
        plannedEnd,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setConflicts(data.conflicts || [])
      })
      .catch(() => {})
      .finally(() => setCheckingConflict(false))
  }, [selectedType, areaId, plannedStart, plannedEnd])

  const currentPlant = plants.find((p) => p.id === plantId)
  const currentAreas = currentPlant ? currentPlant.areas : []
  const currentArea = currentAreas.find((a: any) => a.id === areaId)
  const currentEquipmentList = currentArea ? currentArea.equipment : []

  const handleTypeFieldChange = (name: string, value: any) => {
    setTypeData((prev) => ({ ...prev, [name]: value }))
  }

  const togglePrecaution = (id: string) => {
    setPrecautions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    )
  }

  const toggleHazard = (hazard: string) => {
    setHazards((prev) =>
      prev.includes(hazard) ? prev.filter((h) => h !== hazard) : [...prev, hazard]
    )
  }

  const togglePpe = (item: string) => {
    setPpeRequired((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    )
  }

  // --------------------------------------------------------------------------
  // PERMIT SUBMISSION & DRAFT SAVING HANDLER
  // --------------------------------------------------------------------------
  // submitNow = false -> Saves as private draft (status: DRAFT, visible only to requester)
  // submitNow = true  -> Submits to Area Owner & Safety Officer (status: PENDING_APPROVAL)
  const handleSaveOrSubmit = async (submitNow: boolean) => {
    setError("")
    if (!workDescription.trim()) {
      setError("Please describe the planned maintenance or engineering work.")
      return
    }

    setSubmitting(true)

    // Sanitize and format type-specific fields (numbers, comma-separated isolation points)
    const sanitizedTypeData: Record<string, any> = { ...typeData }
    currentConfig.fields.forEach((f) => {
      if (f.type === "number") {
        sanitizedTypeData[f.name] = Number(sanitizedTypeData[f.name]) || 0
      } else if (f.name === "isolationPoints" && typeof sanitizedTypeData[f.name] === "string") {
        sanitizedTypeData[f.name] = sanitizedTypeData[f.name].split(",").map((s: string) => s.trim()).filter(Boolean)
      }
    })

    // Construct the complete industrial permit payload
    const payload = {
      type: selectedType,
      plantId,
      areaId,
      equipmentId: equipmentId || null,
      contractorTeam,
      workDescription,
      photoUrl: photoUrl.trim() || null,
      plannedStart,
      plannedEnd,
      hazards,
      ppeRequired,
      precautionsChecklist: precautions,
      typeSpecificData: sanitizedTypeData,
      submitNow, // Boolean flag determining DRAFT vs PENDING_APPROVAL
    }

    try {
      // If editing an existing draft, update with PUT; otherwise create new with POST
      const apiUrl = isEditingDraft ? `/api/permits/${editDraftId}` : "/api/permits"
      const apiMethod = isEditingDraft ? "PUT" : "POST"

      const res = await fetch(apiUrl, {
        method: apiMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save permit")
      } else {
        const permitId = data.permit?.id || editDraftId
        if (isEditingDraft && submitNow) {
          // If transitioning an existing draft to submitted, trigger the SUBMIT action
          await fetch(`/api/permits/${permitId}/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "SUBMIT" }),
          })
        }

        const permitNum = data.permit?.permitNumber || ""
        if (!submitNow) {
          // Action 1: Saved as draft -> Return to dashboard with draft success banner
          router.push(`/?notify=draft_saved&num=${encodeURIComponent(permitNum)}`)
          router.refresh()
        } else {
          // Action 2: Submitted for approval -> Return to dashboard with submission success banner
          router.push(`/?notify=submitted&num=${encodeURIComponent(permitNum)}`)
          router.refresh()
        }
      }
    } catch (err: any) {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading permit builder...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Permits
        </button>
        <span className="text-xs text-slate-500 font-mono">
          Logged in as: {currentUser?.name} ({currentUser?.role})
        </span>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
            {isEditingDraft ? "Edit Draft Permit to Work" : "Raise Permit to Work"}
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            {isEditingDraft
              ? "Modify safety checks and parameters on this saved draft before submission."
              : "Single shared industrial permit workflow with type-specific safety controls."}
          </p>
        </div>

        {draftSavedToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-semibold rounded-lg flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center gap-2.5">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <span>Draft saved successfully! Returning to Dashboard...</span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full font-mono">
              Saved as DRAFT
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* PROMINENT CONFLICT WARNING BANNER */}
        {conflicts.length > 0 && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>SAFETY CONFLICT WARNING DETECTED</span>
            </div>
            {conflicts.map((c, idx) => (
              <div key={idx} className="text-xs text-red-700 bg-white/70 p-2.5 rounded-lg border border-red-200">
                <strong>{c.warning}</strong>
                <div className="mt-1 text-[11px] text-red-600">
                  Conflicting Permit: <span className="font-mono font-bold">{c.permitNumber}</span> ({c.type}) • Requester: {c.requesterName}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Permit Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            1. Select Permit Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_LOTO"] as PermitType[]).map((t) => {
              const def = PERMIT_TYPE_REGISTRY[t]
              const isSelected = selectedType === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`min-h-[48px] p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-xs font-bold ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                    {def.label}
                  </span>
                  <span className="text-[10px] text-slate-500 line-clamp-1 mt-1">
                    {def.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Location & Work Details */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Asset Hierarchy & Work Information
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plant</label>
              <select
                value={plantId}
                onChange={(e) => {
                  setPlantId(e.target.value)
                  const p = plants.find((item) => item.id === e.target.value)
                  if (p && p.areas.length > 0) setAreaId(p.areas[0].id)
                }}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plant Area</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {currentAreas.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Equipment Tag (Optional)
              </label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="">General Area / No specific equipment</option>
                {currentEquipmentList.map((eq: any) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.tagCode} - {eq.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Contractor Company / Maintenance Team
              </label>
              <input
                type="text"
                value={contractorTeam}
                onChange={(e) => setContractorTeam(e.target.value)}
                placeholder="e.g. In-house Mechanical, L&T Site Crew"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Photo Reference URL (Optional)
              </label>
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/site-photos/area-photo.jpg"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Work Description & Scope
            </label>
            <textarea
              rows={2}
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="Clearly state maintenance activity, tools, isolation required, and work method..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Planned Start (Date & Time)
              </label>
              <input
                type="datetime-local"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Planned End (Date & Time)
              </label>
              <input
                type="datetime-local"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Type-Specific Fields Driven by permitTypeConfig.ts */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              3. {currentConfig.label} - Type-Specific Safety Controls
            </label>
            <span className="text-[11px] text-blue-600 font-mono">
              Config: {selectedType}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            {currentConfig.fields.map((field) => {
              const val = typeData[field.name]

              if (field.type === "select") {
                return (
                  <div key={field.name}>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={val || ""}
                      onChange={(e) => handleTypeFieldChange(field.name, e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (field.type === "boolean") {
                return (
                  <div key={field.name} className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id={field.name}
                      checked={Boolean(val)}
                      onChange={(e) => handleTypeFieldChange(field.name, e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor={field.name} className="text-xs font-semibold text-slate-800">
                      {field.label}
                    </label>
                  </div>
                )
              }

              return (
                <div key={field.name}>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {field.label} {field.unit && `(${field.unit})`} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={field.type === "number" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"}
                    step={field.type === "number" ? "any" : undefined}
                    value={val !== undefined ? val : ""}
                    onChange={(e) => handleTypeFieldChange(field.name, e.target.value)}
                    placeholder={field.description}
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  {field.description && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {field.description}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 4: Hazards, PPE & Safety Checklist */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            4. Safety Precautions & Checklists
          </label>

          {/* Precautions checkboxes */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-700">Mandatory Precautions</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {precautions.map((p) => (
                <label
                  key={p.id}
                  onClick={() => togglePrecaution(p.id)}
                  className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 cursor-pointer transition ${
                    p.checked ? "bg-emerald-50/60 border-emerald-300 text-emerald-950 font-medium" : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={p.checked}
                    readOnly
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* PPE tags */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-semibold text-slate-700">Required Personal Protective Equipment (PPE)</span>
            <div className="flex flex-wrap gap-1.5">
              {currentConfig.standardPpe.map((item) => {
                const active = ppeRequired.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => togglePpe(item)}
                    className={`px-2.5 py-1 rounded-full text-xs transition border ${
                      active
                        ? "bg-blue-50 text-blue-700 border-blue-300 font-medium"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {active ? "✓ " : "+ "} {item}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons: Save Draft vs Submit */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveOrSubmit(false)}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            Save as Draft
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveOrSubmit(true)}
            className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreatePermitPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <RotateCw className="w-5 h-5 animate-spin text-blue-600" />
          Loading permit workspace...
        </div>
      }
    >
      <PermitFormContent />
    </Suspense>
  )
}
