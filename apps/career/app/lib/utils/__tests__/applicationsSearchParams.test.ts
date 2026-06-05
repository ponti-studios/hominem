import { describe, expect, it } from "vitest";

import { buildApplicationsSearchParams } from "../applicationsSearchParams";

describe("buildApplicationsSearchParams", () => {
  it("updates search and resets page through the route helper shape", () => {
    const params = new URLSearchParams("page=3&status=APPLIED");
    const next = buildApplicationsSearchParams(params, {
      search: "staff",
      page: "1",
    });

    expect(next.get("search")).toBe("staff");
    expect(next.get("page")).toBe("1");
    expect(next.getAll("status")).toEqual(["APPLIED"]);
  });

  it("replaces multi-value status filters", () => {
    const params = new URLSearchParams("status=APPLIED&status=INTERVIEW");
    const next = buildApplicationsSearchParams(params, {
      status: ["OFFER", "REJECTED"],
    });

    expect(next.getAll("status")).toEqual(["OFFER", "REJECTED"]);
  });

  it("clears empty filters from the query string", () => {
    const params = new URLSearchParams("search=design&source=LinkedIn&page=2");
    const next = buildApplicationsSearchParams(params, {
      search: null,
      source: "",
      page: "1",
    });

    expect(next.has("search")).toBe(false);
    expect(next.has("source")).toBe(false);
    expect(next.get("page")).toBe("1");
  });
});
