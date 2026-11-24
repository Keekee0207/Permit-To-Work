import { PrismaClient, Role, PermitType, PermitStatus, ApprovalDecision, ExtensionStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding Opmaint PTW industrial database...")

  // Clean existing tables in reverse dependency order
  await prisma.auditLog.deleteMany({})
  await prisma.extensionRequest.deleteMany({})
  await prisma.permitApproval.deleteMany({})
  await prisma.permit.deleteMany({})
  await prisma.equipment.deleteMany({})
  await prisma.userArea.deleteMany({})
  await prisma.area.deleteMany({})
  await prisma.plant.deleteMany({})
  await prisma.user.deleteMany({})

  const defaultPasswordHash = await bcrypt.hash("Password@123", 10)

  // 1. Create 4 Demo Users (one for each role)
  console.log("Creating demo users...")
  const requester = await prisma.user.create({
    data: {
      name: "Rajesh Kumar",
      email: "requester@chennai.opmaint.com",
      passwordHash: defaultPasswordHash,
      role: Role.REQUESTER,
    },
  })

  const areaOwner = await prisma.user.create({
    data: {
      name: "M. Senthil",
      email: "areaowner@chennai.opmaint.com",
      passwordHash: defaultPasswordHash,
      role: Role.AREA_OWNER,
    },
  })

  const safetyOfficer = await prisma.user.create({
    data: {
      name: "K. Radhakrishnan",
      email: "safety@chennai.opmaint.com",
      passwordHash: defaultPasswordHash,
      role: Role.SAFETY_OFFICER,
    },
  })

  const admin = await prisma.user.create({
    data: {
      name: "Pooja Nair",
      email: "admin@chennai.opmaint.com",
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
    },
  })

  // 2. Create 2 Indian Manufacturing Plants
  console.log("Creating plants...")
  const plant1 = await prisma.plant.create({
    data: {
      name: "Chennai Heavy Engineering Plant 1",
      code: "CHE-01",
      location: "Ambattur Industrial Estate, Chennai, Tamil Nadu",
    },
  })

  const plant2 = await prisma.plant.create({
    data: {
      name: "Sriperumbudur Auto-Component Plant 2",
      code: "SRP-02",
      location: "SIPCOT Industrial Park, Sriperumbudur, Tamil Nadu",
    },
  })

  // 3. Create 4 Areas
  console.log("Creating areas...")
  const area1 = await prisma.area.create({
    data: {
      name: "Boiler & Steam Utility Area",
      code: "BLR-AREA",
      plantId: plant1.id,
    },
  })

  const area2 = await prisma.area.create({
    data: {
      name: "Solvent Reaction Vessel Bay",
      code: "RCT-BAY",
      plantId: plant1.id,
    },
  })

  const area3 = await prisma.area.create({
    data: {
      name: "High Voltage Substation & MCC Room",
      code: "HV-MCC",
      plantId: plant2.id,
    },
  })

  const area4 = await prisma.area.create({
    data: {
      name: "Stamping Press & Overhead Crane Bay",
      code: "STP-BAY",
      plantId: plant2.id,
    },
  })

  // Assign Area Owner to Area 1 (Boiler Area) & Area 2 (Reaction Bay)
  await prisma.userArea.createMany({
    data: [
      { userId: areaOwner.id, areaId: area1.id },
      { userId: areaOwner.id, areaId: area2.id },
    ],
  })

  // 4. Create ~6 Realistic Equipment Tag Items
  console.log("Creating equipment tags...")
  const eq1 = await prisma.equipment.create({
    data: {
      tagCode: "BLR-01-STM",
      name: "Thermax 10 TPH Steam Boiler Unit A",
      areaId: area1.id,
      description: "High pressure steam generator and superheater manifold",
    },
  })

  const eq2 = await prisma.equipment.create({
    data: {
      tagCode: "IDF-02-MOT",
      name: "Induced Draft Fan 75kW Motor",
      areaId: area1.id,
      description: "Flue gas exhaust extraction blower drive",
    },
  })

  const eq3 = await prisma.equipment.create({
    data: {
      tagCode: "RCT-201-VSS",
      name: "5000L Glass-Lined Polymerizer Reactor",
      areaId: area2.id,
      description: "Jacketed chemical synthesis reactor vessel with top agitator",
    },
  })

  const eq4 = await prisma.equipment.create({
    data: {
      tagCode: "SUB-11KV-XFMR",
      name: "11kV/415V 1600kVA Distribution Transformer",
      areaId: area3.id,
      description: "Oil immersed step down transformer and bus-duct feed",
    },
  })

  const eq5 = await prisma.equipment.create({
    data: {
      tagCode: "MCC-04-FEED",
      name: "Motor Control Center Breaker Panel 4",
      areaId: area3.id,
      description: "415V switchgear with air circuit breakers",
    },
  })

  const eq6 = await prisma.equipment.create({
    data: {
      tagCode: "EOT-CRANE-15T",
      name: "Overhead Traveling Crane 15T",
      areaId: area4.id,
      description: "Dual girder overhead shop crane on 9.5m gantry rail",
    },
  })

  // 5. Create ~10 Realistic Permits Across All States
  console.log("Creating permits across all lifecycle states...")
  const now = new Date()

  // PERMIT 1: DRAFT (Working at height)
  const p1 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0001",
      type: PermitType.WORKING_AT_HEIGHT,
      status: PermitStatus.DRAFT,
      requesterId: requester.id,
      contractorTeam: "Madras Scaffolding Services",
      workDescription: "Inspection and recoating of overhead structural gantry beams at 8m height.",
      plantId: plant2.id,
      areaId: area4.id,
      equipmentId: eq6.id,
      plannedStart: new Date(now.getTime() + 2 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 8 * 3600 * 1000),
      hazards: ["Fall from Height", "Falling Tools onto Personnel Below"],
      ppeRequired: ["Full Body Harness with Double Lanyard", "Safety Helmet with Chin Strap"],
      precautionsChecklist: [
        { id: "scaffold_tag", label: "Scaffold green tag verified", checked: true },
        { id: "ground_barricade", label: "Drop zone barricading complete", checked: true },
      ],
      typeSpecificData: {
        heightMeters: 8.5,
        accessMethod: "scaffold",
        fallArrestEquipment: "Dual lanyard harness connected to certified wire rope lifeline",
        anchorPointChecked: true,
        barricadingBelow: true,
      },
    },
  })
  await prisma.auditLog.create({
    data: {
      permitId: p1.id,
      actorId: requester.id,
      action: "CREATED_DRAFT",
      comment: "Draft created for weekend structural maintenance.",
    },
  })

  // PERMIT 2: PENDING_APPROVAL (Hot Work in Boiler Area)
  const p2 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0002",
      type: PermitType.HOT_WORK,
      status: PermitStatus.PENDING_APPROVAL,
      requesterId: requester.id,
      contractorTeam: "Thermax Boiler Specialist Team",
      workDescription: "Welding flange repair on secondary steam header piping near Boiler 1.",
      plantId: plant1.id,
      areaId: area1.id,
      equipmentId: eq1.id,
      plannedStart: new Date(now.getTime() - 1 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 5 * 3600 * 1000),
      hazards: ["Fire and Explosion", "Sparks and Slag Dispersion", "Thermal Burns"],
      ppeRequired: ["Welding Helmet", "Leather Welding Gloves", "Safety Boots"],
      precautionsChecklist: [
        { id: "fire_extinguisher", label: "DCP & CO2 extinguishers positioned", checked: true },
        { id: "combustibles_cleared", label: "10m radius clearance verified", checked: true },
      ],
      typeSpecificData: {
        hotWorkType: "welding",
        fireWatchAssigned: "V. Murugan",
        fireExtinguisherType: "6kg DCP & 4.5kg CO2",
        combustiblesClearedRadiusMeters: 10,
        gasTestLelPercent: 0,
        gasTestO2Percent: 20.9,
        gasTestTime: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p2.id, requiredRole: Role.AREA_OWNER, decision: ApprovalDecision.PENDING },
      { permitId: p2.id, requiredRole: Role.SAFETY_OFFICER, decision: ApprovalDecision.PENDING },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p2.id,
      actorId: requester.id,
      action: "SUBMITTED",
      comment: "Submitted for Area Owner and Safety Officer sign-off.",
    },
  })

  // PERMIT 3: APPROVED (Awaiting Activation)
  const p3 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0003",
      type: PermitType.ELECTRICAL_LOTO,
      status: PermitStatus.APPROVED,
      requesterId: requester.id,
      contractorTeam: "Schneider Electric Field Engineers",
      workDescription: "Annual contact inspection and busbar torque verification on MCC-04.",
      plantId: plant2.id,
      areaId: area3.id,
      equipmentId: eq5.id,
      plannedStart: new Date(now.getTime() - 2 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 6 * 3600 * 1000),
      hazards: ["High Voltage Arc Flash", "Electric Shock"],
      ppeRequired: ["Arc Flash Suit 40 Cal", "11kV Insulating Gloves"],
      precautionsChecklist: [{ id: "loto_locked", label: "Padlock applied to feeder", checked: true }],
      typeSpecificData: {
        equipmentTag: "MCC-04-FEED",
        voltageLevel: "415V",
        isolationPoints: ["Incomer Breaker ACB-04", "Control Fuse F1"],
        lockNumbers: "PADLOCK-RED-882",
        tagNumbers: "DANGER-TAG-104",
        earthingApplied: true,
        testedDeadBy: "R. Natarajan (Lic # A-4491)",
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      {
        permitId: p3.id,
        requiredRole: Role.AREA_OWNER,
        approverId: admin.id, // Admin approved on behalf of area
        decision: ApprovalDecision.APPROVED,
        comment: "Isolations and schematics reviewed.",
        reviewedAt: new Date(now.getTime() - 3 * 3600 * 1000),
      },
      {
        permitId: p3.id,
        requiredRole: Role.SAFETY_OFFICER,
        approverId: safetyOfficer.id,
        decision: ApprovalDecision.APPROVED,
        comment: "Electrical LOTO safe procedure verified.",
        reviewedAt: new Date(now.getTime() - 2 * 3600 * 1000),
      },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p3.id,
      actorId: safetyOfficer.id,
      action: "APPROVAL_RECORDED",
      fromValue: "PENDING_APPROVAL",
      toValue: "APPROVED",
      comment: "All approvals in place. Ready to activate on shop floor.",
    },
  })

  // PERMIT 4: ACTIVE (Expiring Soon - 45 minutes left!)
  const p4 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0004",
      type: PermitType.HOT_WORK,
      status: PermitStatus.ACTIVE,
      requesterId: requester.id,
      contractorTeam: "L&T Heavy Fabricators",
      workDescription: "Grinding and bracket welding for induced draft motor baseplate.",
      plantId: plant1.id,
      areaId: area1.id,
      equipmentId: eq2.id,
      plannedStart: new Date(now.getTime() - 3 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 45 * 60 * 1000), // EXPIRING IN 45 MINS!
      hazards: ["Sparks", "Hot Metal", "Noise"],
      ppeRequired: ["Welding Face Shield", "Ear Plugs", "Leather Apron"],
      precautionsChecklist: [{ id: "spark_barrier", label: "Spark barriers erected", checked: true }],
      typeSpecificData: {
        hotWorkType: "grinding",
        fireWatchAssigned: "K. Selvam",
        fireExtinguisherType: "DCP 6kg",
        combustiblesClearedRadiusMeters: 10,
        gasTestLelPercent: 0,
        gasTestO2Percent: 20.9,
        gasTestTime: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      {
        permitId: p4.id,
        requiredRole: Role.AREA_OWNER,
        approverId: areaOwner.id,
        decision: ApprovalDecision.APPROVED,
        comment: "Area cleared for grinding work.",
        reviewedAt: new Date(now.getTime() - 4 * 3600 * 1000),
      },
      {
        permitId: p4.id,
        requiredRole: Role.SAFETY_OFFICER,
        approverId: safetyOfficer.id,
        decision: ApprovalDecision.APPROVED,
        comment: "Extinguishers in place.",
        reviewedAt: new Date(now.getTime() - 3.5 * 3600 * 1000),
      },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p4.id,
      actorId: requester.id,
      action: "STATUS_CHANGE",
      fromValue: "APPROVED",
      toValue: "ACTIVE",
      comment: "Permit active on shop floor.",
    },
  })

  // PERMIT 5: ACTIVE (Confined Space with Entry Logs)
  const p5 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0005",
      type: PermitType.CONFINED_SPACE,
      status: PermitStatus.ACTIVE,
      requesterId: requester.id,
      contractorTeam: "CleanTank Industrial Services",
      workDescription: "Internal chemical descaling and thickness gauging inside Polymerizer Reactor R-201.",
      plantId: plant1.id,
      areaId: area2.id,
      equipmentId: eq3.id,
      plannedStart: new Date(now.getTime() - 2 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 4 * 3600 * 1000),
      hazards: ["Oxygen Deficiency", "Toxic Chemical Vapors", "Confined Space Entrapment"],
      ppeRequired: ["4-Gas Monitor", "Rescue Full Body Harness", "Breathing Apparatus (EEBA)"],
      precautionsChecklist: [
        { id: "ventilation", label: "Forced air blower active", checked: true },
        { id: "attendant", label: "Standby attendant at manhole", checked: true },
      ],
      typeSpecificData: {
        spaceId: "RCT-201-VSS",
        entryPoint: "Top 24-inch vessel manway",
        o2Percent: 20.9,
        lelPercent: 0,
        h2sPpm: 0,
        coPpm: 0,
        atmosphericTestTime: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        standbyAttendantName: "D. Palanivel",
        rescuePlan: "Tripod winch with retrieval lanyard attached to harness.",
        ventilationMethod: "Continuous 1200 CFM electric blower",
        entryExitLog: [
          {
            id: "entry-01",
            personName: "S. Manikandan",
            badgeNumber: "CT-8891",
            entryTime: new Date(now.getTime() - 1.5 * 3600 * 1000).toISOString(),
            exitTime: null, // Currently inside
          },
          {
            id: "entry-02",
            personName: "A. Robert",
            badgeNumber: "CT-8892",
            entryTime: new Date(now.getTime() - 1.5 * 3600 * 1000).toISOString(),
            exitTime: new Date(now.getTime() - 0.5 * 3600 * 1000).toISOString(),
          },
        ],
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      {
        permitId: p5.id,
        requiredRole: Role.AREA_OWNER,
        approverId: areaOwner.id,
        decision: ApprovalDecision.APPROVED,
        comment: "Lines disconnected and blinded.",
        reviewedAt: new Date(now.getTime() - 3 * 3600 * 1000),
      },
      {
        permitId: p5.id,
        requiredRole: Role.SAFETY_OFFICER,
        approverId: safetyOfficer.id,
        decision: ApprovalDecision.APPROVED,
        comment: "Gas test zero toxicity confirmed.",
        reviewedAt: new Date(now.getTime() - 2.5 * 3600 * 1000),
      },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p5.id,
      actorId: requester.id,
      action: "CONFINED_SPACE_ENTRY",
      comment: "Technician S. Manikandan entered vessel.",
    },
  })

  // PERMIT 6: SUSPENDED (High wind weather alert)
  const p6 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0006",
      type: PermitType.WORKING_AT_HEIGHT,
      status: PermitStatus.SUSPENDED,
      requesterId: requester.id,
      contractorTeam: "Madras Scaffolding Services",
      workDescription: "External roof gutter and solar panel cabling at 12m height.",
      plantId: plant2.id,
      areaId: area4.id,
      equipmentId: eq6.id,
      plannedStart: new Date(now.getTime() - 4 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 3 * 3600 * 1000),
      hazards: ["High Wind Speeds", "Fall from Height"],
      ppeRequired: ["Harness", "Hard Hat"],
      precautionsChecklist: [{ id: "wind_check", label: "Anemometer check", checked: true }],
      typeSpecificData: {
        heightMeters: 12,
        accessMethod: "MEWP",
        fallArrestEquipment: "Boom harness with inertia reel",
        anchorPointChecked: true,
        barricadingBelow: true,
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p6.id, requiredRole: Role.AREA_OWNER, decision: ApprovalDecision.APPROVED, approverId: admin.id },
      { permitId: p6.id, requiredRole: Role.SAFETY_OFFICER, decision: ApprovalDecision.APPROVED, approverId: safetyOfficer.id },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p6.id,
      actorId: safetyOfficer.id,
      action: "SUSPENDED",
      fromValue: "ACTIVE",
      toValue: "SUSPENDED",
      comment: "Sudden gusty winds recorded at 48 km/h. Suspended for outdoor fall safety.",
    },
  })

  // PERMIT 7: EXPIRED (Validity exceeded)
  const p7 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0007",
      type: PermitType.HOT_WORK,
      status: PermitStatus.EXPIRED,
      requesterId: requester.id,
      contractorTeam: "Apex Pipefitters",
      workDescription: "Header pipeline cut in auxiliary yard.",
      plantId: plant1.id,
      areaId: area1.id,
      plannedStart: new Date(now.getTime() - 24 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() - 16 * 3600 * 1000),
      hazards: ["Hot Work", "Sparks"],
      ppeRequired: ["Welding Hood"],
      precautionsChecklist: [],
      typeSpecificData: {
        hotWorkType: "cutting",
        fireWatchAssigned: "J. Kumar",
        fireExtinguisherType: "CO2",
        combustiblesClearedRadiusMeters: 5,
        gasTestLelPercent: 0,
        gasTestO2Percent: 20.8,
        gasTestTime: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
      },
    },
  })
  await prisma.auditLog.create({
    data: {
      permitId: p7.id,
      actorId: requester.id,
      action: "AUTO_EXPIRED",
      fromValue: "ACTIVE",
      toValue: "EXPIRED",
      comment: "Permit expired after shift end without formal closure request.",
    },
  })

  // PERMIT 8: CLOSED (Work Complete, awaiting Safety Officer Verification)
  const p8 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0008",
      type: PermitType.ELECTRICAL_LOTO,
      status: PermitStatus.CLOSED,
      requesterId: requester.id,
      contractorTeam: "In-House Electrical Team",
      workDescription: "Relay calibration and trip test on 11kV Substation Transformer.",
      plantId: plant2.id,
      areaId: area3.id,
      equipmentId: eq4.id,
      plannedStart: new Date(now.getTime() - 6 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 1 * 3600 * 1000),
      completionNotes: "All relay tests passed. Test leads removed and covers bolted.",
      hazards: ["High Voltage"],
      ppeRequired: ["Insulated Gloves"],
      precautionsChecklist: [],
      typeSpecificData: {
        equipmentTag: "SUB-11KV-XFMR",
        voltageLevel: "11kV",
        isolationPoints: ["11kV Incomer VCB"],
        lockNumbers: "LK-901",
        tagNumbers: "TAG-901",
        earthingApplied: true,
        testedDeadBy: "R. Natarajan",
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p8.id, requiredRole: Role.AREA_OWNER, decision: ApprovalDecision.APPROVED, approverId: admin.id },
      { permitId: p8.id, requiredRole: Role.SAFETY_OFFICER, decision: ApprovalDecision.APPROVED, approverId: safetyOfficer.id },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p8.id,
      actorId: requester.id,
      action: "CLOSED",
      fromValue: "ACTIVE",
      toValue: "CLOSED",
      comment: "Work completed. Ready for safety officer de-isolation sign-off.",
    },
  })

  // PERMIT 9: CLOSED_VERIFIED (Fully verified by Safety Officer)
  const p9 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0009",
      type: PermitType.HOT_WORK,
      status: PermitStatus.CLOSED_VERIFIED,
      requesterId: requester.id,
      contractorTeam: "Thermax Boiler Specialists",
      workDescription: "Boiler burner nozzle replacement and seal welding.",
      plantId: plant1.id,
      areaId: area1.id,
      equipmentId: eq1.id,
      plannedStart: new Date(now.getTime() - 10 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() - 2 * 3600 * 1000),
      completionNotes: "Burner nozzle torqued and tested.",
      hazards: ["Hot Work"],
      ppeRequired: ["Welding Gear"],
      precautionsChecklist: [],
      typeSpecificData: {
        hotWorkType: "soldering",
        fireWatchAssigned: "V. Murugan",
        fireExtinguisherType: "DCP",
        combustiblesClearedRadiusMeters: 10,
        gasTestLelPercent: 0,
        gasTestO2Percent: 20.9,
        gasTestTime: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p9.id, requiredRole: Role.AREA_OWNER, decision: ApprovalDecision.APPROVED, approverId: areaOwner.id },
      { permitId: p9.id, requiredRole: Role.SAFETY_OFFICER, decision: ApprovalDecision.APPROVED, approverId: safetyOfficer.id },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p9.id,
      actorId: safetyOfficer.id,
      action: "CLOSED_VERIFIED",
      fromValue: "CLOSED",
      toValue: "CLOSED_VERIFIED",
      comment: "Safety Officer inspected site. Fire watch 30-min complete, area cleaned and handed over to Production.",
    },
  })

  // PERMIT 10: REJECTED (Unsafe atmosphere / inadequate LEL clearance)
  const p10 = await prisma.permit.create({
    data: {
      permitNumber: "PTW-2024-0010",
      type: PermitType.CONFINED_SPACE,
      status: PermitStatus.REJECTED,
      requesterId: requester.id,
      contractorTeam: "Southern Tank Cleaners",
      workDescription: "Sludge scooping in underground diesel storage sump.",
      plantId: plant1.id,
      areaId: area2.id,
      plannedStart: new Date(now.getTime() - 5 * 3600 * 1000),
      plannedEnd: new Date(now.getTime() + 2 * 3600 * 1000),
      hazards: ["Flammable Vapors"],
      ppeRequired: ["Respirator"],
      precautionsChecklist: [],
      typeSpecificData: {
        spaceId: "SUMP-DSL-01",
        entryPoint: "Top ground grate",
        o2Percent: 18.2, // DEFICIENT
        lelPercent: 15,  // HIGH LEL
        h2sPpm: 12,
        coPpm: 25,
        atmosphericTestTime: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
        standbyAttendantName: "None",
        rescuePlan: "Call fire brigade",
        ventilationMethod: "Natural",
      },
    },
  })
  await prisma.permitApproval.createMany({
    data: [
      { permitId: p10.id, requiredRole: Role.AREA_OWNER, decision: ApprovalDecision.PENDING },
      {
        permitId: p10.id,
        requiredRole: Role.SAFETY_OFFICER,
        approverId: safetyOfficer.id,
        decision: ApprovalDecision.REJECTED,
        comment: "REJECTED: O2 is below safe threshold (18.2%) and LEL is 15%. Forced ventilation mandatory before re-testing.",
        reviewedAt: new Date(now.getTime() - 4 * 3600 * 1000),
      },
    ],
  })
  await prisma.auditLog.create({
    data: {
      permitId: p10.id,
      actorId: safetyOfficer.id,
      action: "REJECTED",
      fromValue: "PENDING_APPROVAL",
      toValue: "REJECTED",
      comment: "Permit rejected by Safety Officer due to dangerous atmospheric gas test readings.",
    },
  })

  console.log("Database seeded successfully with 4 users, 2 plants, 4 areas, 6 equipment, and 10 permits!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
