import { describe, expect, it } from "vitest";

import {
  formatCertificationStatus,
  getCertificationStatusClasses,
} from "../certificationUtils";

describe("certificationUtils", () => {
  it("formats certification statuses for display", () => {
    expect(formatCertificationStatus("pending_renewal")).toBe(
      "Pending Renewal",
    );
    expect(formatCertificationStatus("active")).toBe("Active");
  });

  it("returns certification status classes by status", () => {
    expect(getCertificationStatusClasses("active")).toBe(
      "border-success/30 bg-success/10 text-foreground",
    );
    expect(getCertificationStatusClasses("expired")).toBe(
      "border-destructive/30 bg-destructive/10 text-foreground",
    );
    expect(getCertificationStatusClasses("archived")).toBe(
      "bg-muted text-foreground",
    );
  });
});
