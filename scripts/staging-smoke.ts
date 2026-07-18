async function main() {
const baseUrl = String(
  process.env
    .ASKSOCIAL_STAGING_URL ||
    process.argv[2] ||
    ""
).replace(/\/$/, "");
const sessionCookie = String(
  process.env
    .ASKSOCIAL_STAGING_SESSION_COOKIE ||
    ""
).trim();

if (!baseUrl) {
  throw new Error(
    "Provide ASKSOCIAL_STAGING_URL or pass the staging URL as the first argument."
  );
}

type Check = {
  name: string;
  status: "passed" | "skipped";
  detail: string;
};

const checks: Check[] = [];

async function request(
  pathname: string,
  options: RequestInit = {}
) {
  return fetch(
    `${baseUrl}${pathname}`,
    {
      ...options,
      redirect: "manual",
      headers: {
        ...(sessionCookie
          ? { cookie: sessionCookie }
          : {}),
        ...(options.headers || {}),
      },
    }
  );
}

const publicHome =
  await request("/");

if (publicHome.status !== 200) {
  throw new Error(
    `Public home failed with HTTP ${publicHome.status}.`
  );
}
checks.push({
  name: "public_home",
  status: "passed",
  detail: "HTTP 200",
});

if (!sessionCookie) {
  const protectedWorkspace =
    await request("/workspace");
  const protectedApi =
    await request(
      "/api/entitlements/me"
    );

  if (
    ![301, 302, 303, 307, 308].includes(
      protectedWorkspace.status
    )
  ) {
    throw new Error(
      `Unauthenticated workspace access was not redirected; received HTTP ${protectedWorkspace.status}.`
    );
  }

  if (
    ![
      301,
      302,
      303,
      307,
      308,
      401,
    ].includes(protectedApi.status)
  ) {
    throw new Error(
      `Unauthenticated entitlement API access was not blocked; received HTTP ${protectedApi.status}.`
    );
  }

  checks.push(
    {
      name:
        "unauthenticated_workspace",
      status: "passed",
      detail: `HTTP ${protectedWorkspace.status}`,
    },
    {
      name:
        "unauthenticated_api",
      status: "passed",
      detail: `HTTP ${protectedApi.status}`,
    },
    {
      name: "authenticated_flow",
      status: "skipped",
      detail:
        "ASKSOCIAL_STAGING_SESSION_COOKIE was not provided.",
    }
  );
} else {
  const entitlementResponse =
    await request(
      "/api/entitlements/me"
    );
  const entitlementBody =
    await entitlementResponse.json();

  if (
    entitlementResponse.status !==
      200 ||
    !entitlementBody.ok ||
    !entitlementBody.entitlements
      ?.capabilities
  ) {
    throw new Error(
      "Authenticated entitlement resolution failed."
    );
  }

  const areasResponse =
    await request(
      "/api/therapeutic-areas"
    );
  const areasBody =
    await areasResponse.json();

  if (
    areasResponse.status !== 200 ||
    !areasBody.ok ||
    !Array.isArray(
      areasBody.analyticalCoverage
    )
  ) {
    throw new Error(
      "Authenticated therapeutic-area coverage check failed."
    );
  }

  const askResponse = await request(
    "/api/ask",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        question:
          "What should leadership know now?",
        therapeuticArea:
          process.env
            .ASKSOCIAL_STAGING_THERAPEUTIC_AREA ||
          "Regenerative Aesthetics",
      }),
    }
  );
  const askBody =
    await askResponse.json();

  if (
    askResponse.status !== 200 ||
    !askBody.ok ||
    !askBody.answer ||
    !askBody.entitlements ||
    !askBody.analyticalCoverage
  ) {
    throw new Error(
      `Authenticated /api/ask smoke failed with HTTP ${askResponse.status}.`
    );
  }

  checks.push(
    {
      name: "entitlement_resolution",
      status: "passed",
      detail: "Authenticated",
    },
    {
      name:
        "therapeutic_area_coverage",
      status: "passed",
      detail: `${areasBody.analyticalCoverage.length} classified areas`,
    },
    {
      name: "production_ask",
      status: "passed",
      detail:
        `${askBody.analyticalStatus}; ${askBody.debug?.canonicalFindingCount || 0} canonical findings`,
    }
  );
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      checks,
    },
    null,
    2
  )
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
