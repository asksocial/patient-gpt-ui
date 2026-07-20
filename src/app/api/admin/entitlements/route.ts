import {
  clerkClient,
} from "@clerk/nextjs/server";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  ENTITLEMENT_CATALOG,
  ENTITLEMENT_METADATA_KEY,
  normalizeEntitlementMetadata,
  resolveEntitlements,
} from "../../../../lib/entitlements";
import {
  withAdmin,
} from "../../../../lib/auth/isAdmin";
import {
  getKnowledgePersistenceMode,
} from "../../../../lib/knowledge/mode";
import {
  getActiveTherapeuticAreas,
  getUserTherapeuticAreas,
  normalizeTherapeuticAreaAssignments,
  replaceUserTherapeuticAreas,
  validateTherapeuticAreaAssignments,
} from "../../../../lib/therapeuticAccess/server";

export const runtime = "nodejs";

function publicMetadata(
  value: unknown
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? (value as Record<
        string,
        unknown
      >)
    : {};
}

async function loadSubject(
  subjectType: string,
  subjectId: string
) {
  const client =
    await clerkClient();

  if (subjectType === "user") {
    const user =
      await client.users.getUser(
        subjectId
      );
    const metadata = publicMetadata(
      user.publicMetadata
    );

    return {
      subjectType,
      subjectId,
      displayName:
        [
          user.firstName,
          user.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        user.primaryEmailAddress
          ?.emailAddress ||
        subjectId,
      publicMetadata: metadata,
      entitlementMetadata:
        normalizeEntitlementMetadata(
          metadata[
            ENTITLEMENT_METADATA_KEY
          ]
        ),
    };
  }

  if (subjectType === "organization") {
    const organization =
      await client.organizations.getOrganization(
        {
          organizationId:
            subjectId,
        }
      );
    const metadata = publicMetadata(
      organization.publicMetadata
    );

    return {
      subjectType,
      subjectId,
      displayName:
        organization.name,
      publicMetadata: metadata,
      entitlementMetadata:
        normalizeEntitlementMetadata(
          metadata[
            ENTITLEMENT_METADATA_KEY
          ]
        ),
    };
  }

  throw new Error(
    "subjectType must be user or organization"
  );
}

export const GET = withAdmin(
  async (request: Request) => {
    const url = new URL(request.url);
    const subjectType =
      url.searchParams.get(
        "subjectType"
      ) || "user";
    const subjectId = String(
      url.searchParams.get(
        "subjectId"
      ) || ""
    ).trim();

    const therapeuticAreaCatalog =
      await getActiveTherapeuticAreas();

    if (!subjectId) {
      return NextResponse.json({
        ok: true,
        catalog:
          ENTITLEMENT_CATALOG,
        therapeuticAreaCatalog,
        subject: null,
      });
    }

    try {
      const subject =
        await loadSubject(
          subjectType,
          subjectId
        );
      const therapeuticAreas =
        subjectType === "user"
          ? await getUserTherapeuticAreas(
              subjectId
            )
          : null;

      return NextResponse.json({
        ok: true,
        catalog:
          ENTITLEMENT_CATALOG,
        therapeuticAreaCatalog,
        subject: {
          ...subject,
          therapeuticAreas,
        },
        effectivePreview:
          resolveEntitlements({
            userId:
              subjectType === "user"
                ? subjectId
                : "organization-preview",
            organizationId:
              subjectType ===
              "organization"
                ? subjectId
                : undefined,
            userMetadata:
              subjectType === "user"
                ? subject.entitlementMetadata
                : undefined,
            organizationMetadata:
              subjectType ===
              "organization"
                ? subject.entitlementMetadata
                : undefined,
            knowledgePersistenceEnabled:
              getKnowledgePersistenceMode() ===
              "persistent",
          }),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load entitlement subject";
      return NextResponse.json(
        { ok: false, error: message },
        { status: 400 }
      );
    }
  }
);

export const PATCH = withAdmin(
  async (request: NextRequest) => {
    try {
      const body =
        await request.json();
      const subjectType = String(
        body?.subjectType || ""
      ).trim();
      const subjectId = String(
        body?.subjectId || ""
      ).trim();
      const entitlementsProvided =
        Object.prototype.hasOwnProperty.call(
          body || {},
          "entitlements"
        );
      const therapeuticAreasProvided =
        Object.prototype.hasOwnProperty.call(
          body || {},
          "therapeuticAreas"
        );

      if (!subjectId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "subjectId is required",
          },
          { status: 400 }
        );
      }

      if (
        !entitlementsProvided &&
        !therapeuticAreasProvided
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "entitlements or therapeuticAreas is required",
          },
          { status: 400 }
        );
      }

      if (
        subjectType !== "user" &&
        therapeuticAreasProvided
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Therapeutic areas can only be assigned to users",
          },
          { status: 400 }
        );
      }

      const normalized = entitlementsProvided
        ? normalizeEntitlementMetadata(
            body?.entitlements
          )
        : null;
      const overlap = (
        normalized?.grants || []
      ).filter((key) =>
        (
          normalized?.denials || []
        ).includes(key)
      );

      if (overlap.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `Capabilities cannot be both granted and denied: ${overlap.join(
                ", "
              )}`,
          },
          { status: 400 }
        );
      }

      const client =
        await clerkClient();
      const subject =
        await loadSubject(
          subjectType,
          subjectId
        );
      const previousTherapeuticAreas =
        therapeuticAreasProvided
          ? await getUserTherapeuticAreas(
              subjectId
            )
          : [];
      let therapeuticAreas =
        previousTherapeuticAreas;

      if (therapeuticAreasProvided) {
        const requested =
          normalizeTherapeuticAreaAssignments(
            body?.therapeuticAreas
          );
        const active =
          await getActiveTherapeuticAreas();

        validateTherapeuticAreaAssignments(
          requested,
          active
        );

        therapeuticAreas =
          await replaceUserTherapeuticAreas(
            subjectId,
            requested
          );
      }

      const nextPublicMetadata =
        normalized
          ? {
              ...subject.publicMetadata,
              [ENTITLEMENT_METADATA_KEY]:
                normalized,
            }
          : subject.publicMetadata;

      try {
        if (
          normalized &&
          subjectType === "user"
        ) {
          await client.users.updateUserMetadata(
            subjectId,
            {
              publicMetadata:
                nextPublicMetadata,
            }
          );
        } else if (
          normalized &&
          subjectType ===
            "organization"
        ) {
          await client.organizations.updateOrganizationMetadata(
            subjectId,
            {
              publicMetadata:
                nextPublicMetadata,
            }
          );
        } else if (
          subjectType !== "user" &&
          subjectType !==
            "organization"
        ) {
          throw new Error(
            "subjectType must be user or organization"
          );
        }
      } catch (error) {
        if (therapeuticAreasProvided) {
          try {
            await replaceUserTherapeuticAreas(
              subjectId,
              previousTherapeuticAreas
            );
          } catch (rollbackError) {
            console.error(
              "Failed to roll back therapeutic-area assignments",
              rollbackError
            );
          }
        }

        throw error;
      }

      return NextResponse.json({
        ok: true,
        subjectType,
        subjectId,
        entitlements:
          normalized ||
          subject.entitlementMetadata,
        therapeuticAreas:
          subjectType === "user"
            ? therapeuticAreas
            : null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update entitlements";
      return NextResponse.json(
        { ok: false, error: message },
        { status: 400 }
      );
    }
  }
);
