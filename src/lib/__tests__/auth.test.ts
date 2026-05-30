// @vitest-environment node
import { test, expect, vi, beforeEach, describe } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieStore = { set: mockCookieSet };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const COOKIE_NAME = "auth-token";
const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets a cookie with the correct name", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledOnce();
    const [name] = mockCookieSet.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
  });

  test("sets cookie with correct options", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets cookie as non-secure in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.secure).toBe(false);

    vi.unstubAllEnvs();
  });

  test("sets cookie as secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.secure).toBe(true);

    vi.unstubAllEnvs();
  });

  test("cookie expires in approximately 7 days", async () => {
    const before = Date.now();
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");
    const after = Date.now();

    const [, , options] = mockCookieSet.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("sets a valid JWT token as the cookie value", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("user@example.com");
  });

  test("JWT token includes expiration claim", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "user@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.exp).toBeDefined();
    const sevenDaysFromNow = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThan(sevenDaysFromNow - 60);
    expect(payload.exp).toBeLessThanOrEqual(sevenDaysFromNow + 60);
  });
});
