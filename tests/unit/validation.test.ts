import { describe, it, expect } from "vitest";
import { signupSchema, fastTripSchema, contactSchema, flattenErrors, formToObject, emailSchema, type FieldErrors } from "@/lib/validation";
import { safeNext } from "@/lib/auth/safe-next";
import type { z } from "zod";

/** Field errors of a failed parse (empty object when the input was valid). */
const errs = (r: { success: boolean; error?: z.ZodError }): FieldErrors => (!r.success && r.error ? flattenErrors(r.error) : {});

describe("validation", () => {
  it("normalises emails", () => {
    expect(emailSchema.parse("  Someone@Example.COM ")).toBe("someone@example.com");
  });

  it("rejects short or mismatched passwords with translation keys", () => {
    const r = signupSchema.safeParse({ name: "A", email: "a@b.co", password: "short", confirm: "other", terms: "on" });
    expect(r.success).toBe(false);
    const e = errs(r);
    expect(e.password).toBe("passwordShort");
    const r2 = signupSchema.safeParse({ name: "A", email: "a@b.co", password: "longenough1", confirm: "different1", terms: "on" });
    expect(errs(r2).confirm).toBe("passwordMismatch");
  });

  it("requires accepting the terms", () => {
    const r = signupSchema.safeParse({ name: "A", email: "a@b.co", password: "longenough1", confirm: "longenough1" });
    expect(errs(r).terms).toBe("terms");
  });

  const trip = { destination: "rome", startDate: "2027-05-10", endDate: "2027-05-12", adults: "2" };
  it("accepts a valid fast trip and coerces numbers", () => {
    const r = fastTripSchema.safeParse(trip);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.adults).toBe(2);
  });

  it("rejects end before start and trips over 21 days", () => {
    expect(errs(fastTripSchema.safeParse({ ...trip, endDate: "2027-05-01" })).endDate).toBe("dateOrder");
    expect(errs(fastTripSchema.safeParse({ ...trip, endDate: "2027-07-01" })).endDate).toBe("tripTooLong");
  });

  it("rejects unknown interest values", () => {
    expect(fastTripSchema.safeParse({ ...trip, interests: ["hacking"] }).success).toBe(false);
  });

  it("validates the contact form", () => {
    expect(contactSchema.safeParse({ name: "", email: "x", topic: "general", message: "" }).success).toBe(false);
  });

  it("collects repeated form fields into arrays", () => {
    const fd = new FormData();
    fd.append("interests", "food");
    fd.append("interests", "museums");
    fd.append("name", "x");
    expect(formToObject(fd, ["interests"])).toEqual({ interests: ["food", "museums"], name: "x" });
  });

  it("blocks open redirects", () => {
    expect(safeNext("/trips/123")).toBe("/trips/123");
    expect(safeNext("//evil.com")).toBe("/trips");
    expect(safeNext("/\\evil.com")).toBe("/trips");
    expect(safeNext("https://evil.com")).toBe("/trips");
    expect(safeNext(undefined, "/en")).toBe("/en");
  });
});
