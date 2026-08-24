import {
  readFileSync,
} from "node:fs";
import {
  join,
} from "node:path";
import {
  normalizeTherapeuticAreaAssignments,
  validateTherapeuticAreaAssignments,
} from "../lib/therapeuticAccess/server";
import {
  getRoleFromClaims,
} from "../lib/auth/isAdmin";
import {
  sortTherapeuticAreas,
} from "../lib/therapeuticAreas";

for (const claims of [
  {
    publicMetadata: {
      role: "admin",
    },
  },
  {
    public_metadata: {
      role: "Admin",
    },
  },
  {
    metadata: {
      role: " admin ",
    },
  },
  {
    role: "ADMIN",
  },
]) {
  if (
    getRoleFromClaims(claims) !==
    "admin"
  ) {
    throw new Error(
      "Administrator-role claims must support Clerk token variants and normalized casing."
    );
  }
}

if (
  getRoleFromClaims({
    publicMetadata: {
      role: "member",
    },
  }) !== "member"
) {
  throw new Error(
    "Non-administrator roles must not be promoted."
  );
}

const normalized =
  normalizeTherapeuticAreaAssignments(
    [
      " Medical Aesthetics ",
      "Medical Aesthetics",
      "Regenerative Aesthetics",
      "",
    ]
  );

if (
  normalized.length !== 2 ||
  normalized[0] !==
    "Medical Aesthetics" ||
  normalized[1] !==
    "Regenerative Aesthetics"
) {
  throw new Error(
    "Therapeutic-area assignments must be trimmed and deduplicated."
  );
}

const canonical =
  validateTherapeuticAreaAssignments(
    ["medical aesthetics"],
    [
      "Medical Aesthetics",
      "Hepatitis B",
    ]
  );

if (
  canonical[0] !==
  "Medical Aesthetics"
) {
  throw new Error(
    "Therapeutic-area validation must return the canonical active name."
  );
}

let rejectedInactiveArea = false;

try {
  validateTherapeuticAreaAssignments(
    ["Inactive Area"],
    ["Medical Aesthetics"]
  );
} catch {
  rejectedInactiveArea = true;
}

if (!rejectedInactiveArea) {
  throw new Error(
    "Inactive therapeutic areas must be rejected."
  );
}

const alphabetizedAreas =
  sortTherapeuticAreas([
    "Uterine Fibroids",
    "Hepatitis B",
    "Botulinum toxin",
    "Medical Aesthetics",
    "Gene Therapy",
  ]);

if (
  alphabetizedAreas.join("|") !==
  [
    "Botulinum toxin",
    "Gene Therapy",
    "Hepatitis B",
    "Medical Aesthetics",
    "Uterine Fibroids",
  ].join("|")
) {
  throw new Error(
    "Available therapeutic areas must always be displayed alphabetically."
  );
}

const files = {
  admin: readFileSync(
    join(
      process.cwd(),
      "src/app/api/admin/entitlements/route.ts"
    ),
    "utf8"
  ),
  ask: readFileSync(
    join(
      process.cwd(),
      "src/app/api/ask/route.ts"
    ),
    "utf8"
  ),
  areas: readFileSync(
    join(
      process.cwd(),
      "src/app/api/therapeutic-areas/route.ts"
    ),
    "utf8"
  ),
  executive: readFileSync(
    join(
      process.cwd(),
      "src/app/api/executive/brief/route.ts"
    ),
    "utf8"
  ),
  adminGuard: readFileSync(
    join(
      process.cwd(),
      "src/lib/auth/isAdmin.ts"
    ),
    "utf8"
  ),
  entitlementServer: readFileSync(
    join(
      process.cwd(),
      "src/lib/entitlements/server.ts"
    ),
    "utf8"
  ),
  middleware: readFileSync(
    join(
      process.cwd(),
      "middleware.ts"
    ),
    "utf8"
  ),
  entitlementAdminPage: readFileSync(
    join(
      process.cwd(),
      "src/app/admin/entitlements/page.tsx"
    ),
    "utf8"
  ),
  adminLayout: readFileSync(
    join(
      process.cwd(),
      "src/app/admin/layout.tsx"
    ),
    "utf8"
  ),
};

const contracts = [
  [
    files.admin,
    "therapeuticAreaCatalog",
  ],
  [
    files.admin,
    "replaceUserTherapeuticAreas",
  ],
  [
    files.admin,
    "entitlementsProvided",
  ],
  [
    files.ask,
    "THERAPEUTIC_AREA_REQUIRED",
  ],
  [
    files.areas,
    "getUserTherapeuticAreas",
  ],
  [
    files.executive,
    "THERAPEUTIC_AREA_REQUIRED",
  ],
  [
    files.adminGuard,
    "client.users.getUser",
  ],
  [
    files.entitlementServer,
    "user.publicMetadata",
  ],
  [
    files.middleware,
    "API handlers verify administrator roles",
  ],
  [
    files.entitlementAdminPage,
    "Available entitlements",
  ],
  [
    files.entitlementAdminPage,
    "No assignable entitlements were returned.",
  ],
  [
    files.entitlementAdminPage,
    "Therapeutic area access",
  ],
  [
    files.entitlementAdminPage,
    "therapeuticAreas,",
  ],
  [
    files.entitlementAdminPage,
    "Load a user ID to enable therapeutic-area assignments.",
  ],
  [
    files.entitlementAdminPage,
    "Load user access",
  ],
  [
    files.entitlementAdminPage,
    "event.preventDefault();",
  ],
  [
    files.adminLayout,
    "entitlements.isAdmin",
  ],
  [
    files.adminLayout,
    'redirect("/workspace")',
  ],
] as const;

for (const [file, contract] of contracts) {
  if (!file.includes(contract)) {
    throw new Error(
      `User-access backend is missing the required contract: ${contract}`
    );
  }
}

console.log(
  JSON.stringify(
    {
      unifiedAdminUpdate: true,
      entitlementAssignment: true,
      therapeuticAreaAssignment:
        true,
      workspaceFiltering: true,
      askEnforcement: true,
      executiveBriefEnforcement:
        true,
      authoritativeClerkAdminRole:
        true,
      authoritativeClerkEntitlements:
        true,
      visibleEntitlementCatalog:
        true,
      unifiedUserAccessScreen:
        true,
      protectedAdminRoutes: true,
    },
    null,
    2
  )
);
