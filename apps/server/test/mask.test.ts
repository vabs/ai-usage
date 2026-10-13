import { describe, expect, it } from "vitest";
import { maskEmails } from "../src/lib/mask";

describe("maskEmails", () => {
  it("keeps the first letter of each part and the top-level domain", () => {
    expect(maskEmails("dev@acme.io")).toBe("d•••@a•••.io");
    expect(maskEmails("first.last@mail.example.co.uk")).toBe("f•••@m•••.uk");
  });

  it("hides the length of the address", () => {
    expect(maskEmails("averylongname@bigcompany.com")).toBe(maskEmails("a@b.com"));
    expect(maskEmails("a@b.com")).toBe("a•••@b•••.com");
  });

  it("masks addresses inside a longer label and leaves plain names alone", () => {
    expect(maskEmails("Work (dev@acme.io)")).toBe("Work (d•••@a•••.io)");
    expect(maskEmails("Personal")).toBe("Personal");
  });
});
