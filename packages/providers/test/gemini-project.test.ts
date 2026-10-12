import { describe, expect, it } from "vitest";
import { readProjectId, resolveProject } from "../src/gemini";

describe("readProjectId", () => {
  it("accepts empty input and valid project IDs", () => {
    expect(readProjectId("")).toBeUndefined();
    expect(readProjectId("  my-project-123 ")).toBe("my-project-123");
  });

  it("rejects project numbers and malformed IDs before the code is used", () => {
    expect(() => readProjectId("123456789012")).toThrow(/project number/);
    expect(() => readProjectId("My_Project")).toThrow(/isn't a valid/);
  });
});

describe("resolveProject", () => {
  const tier = { id: "standard-tier", name: "Gemini Code Assist" };

  it("uses Google's managed project when there is one", () => {
    expect(resolveProject({ currentTier: { id: "free-tier" }, cloudaicompanionProject: "managed-123" })).toEqual({
      projectId: "managed-123",
      tier: "free-tier",
    });
  });

  it("falls back to the user's project for accounts without a managed one", () => {
    expect(resolveProject({ currentTier: tier, cloudaicompanionProject: null }, "my-project-123")).toEqual({
      projectId: "my-project-123",
      tier: "standard-tier",
    });
  });

  it("asks for a project ID when the account needs one and none was given", () => {
    expect(() => resolveProject({ currentTier: tier })).toThrow(/needs a Google Cloud project ID/);
  });

  it("passes on Google's ineligibility reasons", () => {
    expect(() =>
      resolveProject({ currentTier: tier, ineligibleTiers: [{ reasonMessage: "Not available in your region." }] }),
    ).toThrow(/Not available in your region/);
  });

  it("explains accounts that were never set up, or need verification", () => {
    expect(() => resolveProject({})).toThrow(/Run `gemini` once/);
    expect(() =>
      resolveProject({ ineligibleTiers: [{ reasonCode: "VALIDATION_REQUIRED", validationUrl: "https://example.com/verify" }] }),
    ).toThrow(/verify this account first: https:\/\/example.com\/verify/);
  });
});
