import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
  getUser: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: mocks.auditLogCreate,
    },
    user: {
      findFirst: mocks.userFindFirst,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: mocks.getUser,
    },
  }),
}));

describe("requireCurrentUser", () => {
  test("audits and rejects deactivated authenticated users", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
        },
      },
      error: null,
    });
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      deactivatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.auditLogCreate.mockResolvedValue({ id: "audit-1" });

    const { requireCurrentUser } = await import("@/lib/auth");

    await expect(requireCurrentUser()).rejects.toThrow("deactivated");
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ACCESS_DENIED",
        actorUserId: "user-1",
        entityId: "user-1",
        entityType: "User",
        outcome: "DENIED",
      }),
    });
  });
});
