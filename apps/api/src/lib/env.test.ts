import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("env loading", () => {
  test("loads DATABASE_URL from the api .env file", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.PORT;
    delete process.env.CLIENT_URL;

    const module = await import("./env.js");

    expect(module.env.DATABASE_URL).toContain("agency_crm");
    expect(module.env.PORT).toBe(4000);
    expect(module.env.CLIENT_URL).toBe("http://localhost:5173");
  });
});
