import { describe, expect, test, vi } from "vitest";

import {
  ManuscriptStatus,
  StatusChangeActorType,
  UserRole,
} from "@/generated/prisma/enums";
import { AccessDeniedError } from "@/lib/access-errors";
import {
  ALLOWED_TRANSITIONS,
  assertAllowedTransition,
  assertCanTransitionWithClient,
  getTransitionPolicy,
  transitionStatus,
  type StatusMachineDb,
  type TransitionActor,
} from "@/lib/status-machine";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

function createDb({
  displayId = "JP-2026-00001",
  fromStatus = ManuscriptStatus.DRAFT,
  manuscriptRelationship = true,
  userRoles = [UserRole.AUTHOR],
}: {
  displayId?: string | null;
  fromStatus?: ManuscriptStatus;
  manuscriptRelationship?: boolean;
  userRoles?: UserRole[];
}) {
  const manuscriptFindFirst = vi
    .fn()
    .mockResolvedValueOnce({ id: "manuscript-1", status: fromStatus })
    .mockResolvedValue({ id: "manuscript-1", status: fromStatus, displayId });

  const db = {
    manuscript: {
      findFirst: manuscriptFindFirst,
      update: vi.fn().mockResolvedValue({
        id: "manuscript-1",
        status: ManuscriptStatus.SUBMITTED,
      }),
    },
    manuscriptAuthor: {
      findFirst: vi.fn(),
    },
    manuscriptStatusHistory: {
      create: vi.fn().mockResolvedValue({ id: "history-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    reviewInvitation: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        id: "user-1",
        roles: userRoles,
      }),
    },
  } satisfies StatusMachineDb & { setRelationshipResult?: () => void };

  if (!manuscriptRelationship) {
    manuscriptFindFirst.mockResolvedValueOnce(null);
  }

  return db;
}

describe("status machine transition rules", () => {
  test("exposes valid transitions from DRAFT", () => {
    expect(ALLOWED_TRANSITIONS.DRAFT).toEqual([
      ManuscriptStatus.SUBMITTED,
      ManuscriptStatus.WITHDRAWN,
    ]);
  });

  test("rejects invalid transition edges", () => {
    expect(() =>
      assertAllowedTransition(
        ManuscriptStatus.DRAFT,
        ManuscriptStatus.ACCEPTED,
      ),
    ).toThrow(AccessDeniedError);
  });

  test("maps system actor policy for review start automation", () => {
    expect(
      getTransitionPolicy(
        ManuscriptStatus.REVIEWERS_INVITED,
        ManuscriptStatus.UNDER_REVIEW,
      ),
    ).toMatchObject({
      actorType: "SYSTEM",
      systemAction: "AUTO_REVIEW_STARTED",
    });
  });
});

describe("assertCanTransitionWithClient", () => {
  test("rejects wrong-role users", async () => {
    const db = createDb({
      fromStatus: ManuscriptStatus.WITH_EDITOR,
      userRoles: [UserRole.AUTHOR],
    });

    await expect(
      assertCanTransitionWithClient(
        db,
        { type: "USER", userId: "user-1" },
        "manuscript-1",
        ManuscriptStatus.REVIEWERS_INVITED,
      ),
    ).rejects.toThrow(AccessDeniedError);
  });

  test("accepts matching system action and rejects mismatches", async () => {
    const db = createDb({
      fromStatus: ManuscriptStatus.REVIEWERS_INVITED,
    });
    const actor: TransitionActor = {
      type: "SYSTEM",
      systemAction: "AUTO_REVIEW_STARTED",
    };

    await expect(
      assertCanTransitionWithClient(
        db,
        actor,
        "manuscript-1",
        ManuscriptStatus.UNDER_REVIEW,
      ),
    ).resolves.toBeUndefined();

    const mismatchDb = createDb({
      fromStatus: ManuscriptStatus.REVIEWERS_INVITED,
    });

    await expect(
      assertCanTransitionWithClient(
        mismatchDb,
        { type: "SYSTEM", systemAction: "AUTO_REVIEWS_COMPLETED" },
        "manuscript-1",
        ManuscriptStatus.UNDER_REVIEW,
      ),
    ).rejects.toThrow(AccessDeniedError);
  });
});

describe("transitionStatus", () => {
  test("rejects DRAFT to SUBMITTED without displayId", async () => {
    const tx = createDb({
      displayId: null,
      fromStatus: ManuscriptStatus.DRAFT,
    });

    mockTransaction(tx);

    await expect(
      transitionStatus({
        actor: { type: "USER", userId: "user-1" },
        manuscriptId: "manuscript-1",
        toStatus: ManuscriptStatus.SUBMITTED,
      }),
    ).rejects.toThrow("displayId");
  });

  test("writes status history for a valid transition", async () => {
    const tx = createDb({
      displayId: null,
      fromStatus: ManuscriptStatus.DRAFT,
    });

    mockTransaction(tx);

    await transitionStatus({
      actor: { type: "USER", userId: "user-1" },
      displayId: "JP-2026-00001",
      manuscriptId: "manuscript-1",
      toStatus: ManuscriptStatus.SUBMITTED,
    });

    expect(tx.manuscriptStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: StatusChangeActorType.USER,
        changedById: "user-1",
        fromStatus: ManuscriptStatus.DRAFT,
        manuscriptId: "manuscript-1",
        systemAction: null,
        toStatus: ManuscriptStatus.SUBMITTED,
      }),
    });
  });
});

function mockTransaction(tx: StatusMachineDb) {
  const transaction = vi.mocked(prisma.$transaction) as unknown as {
    mockImplementationOnce: (
      callback: (fn: (client: StatusMachineDb) => Promise<unknown>) => Promise<unknown>,
    ) => void;
  };

  transaction.mockImplementationOnce(async (callback) => callback(tx));
}
