import { describe, expect, it } from "vitest";
import {
  QueryParams,
  RQL,
  parseLinkHeader,
  totalResultsFromHeaders,
} from "../src/index.js";

describe("RQL", () => {
  it("formats every operator, lists, booleans, nulls, and dates", () => {
    expect(RQL.eq("TenantID", 10)).toBe("TenantID,eq,10");
    expect(RQL.in("TenantID", [4, 5, 6])).toBe("TenantID,in,(4,5,6)");
    expect(RQL.in_("TenantID", [4, 5])).toBe("TenantID,in,(4,5)");
    expect(RQL.ne("Name", "Ada")).toBe("Name,ne,Ada");
    expect(RQL.ni("TenantID", [1, 2])).toBe("TenantID,ni,(1,2)");
    expect(RQL.ct("Name", "Smith")).toBe("Name,ct,Smith");
    expect(RQL.sw("Name", "S")).toBe("Name,sw,S");
    expect(RQL.ew("Name", "h")).toBe("Name,ew,h");
    expect(RQL.lt("Amount", 10)).toBe("Amount,lt,10");
    expect(RQL.le("Amount", 10)).toBe("Amount,le,10");
    expect(RQL.gt("Amount", 10)).toBe("Amount,gt,10");
    expect(RQL.ge("DateCreated", new Date("2026-04-23T00:00:00.000Z")))
      .toBe("DateCreated,ge,2026-04-23T00:00:00.000Z");
    expect(RQL.bt("Amount", 1, 3)).toBe("Amount,bt,(1,3)");
    expect(RQL.gtn("ClosedDate", null)).toBe("ClosedDate,gtn,null");
    expect(RQL.gen("Amount", 1)).toBe("Amount,gen,1");
    expect(RQL.ltn("ClosedDate", null)).toBe("ClosedDate,ltn,null");
    expect(RQL.len("Amount", 1)).toBe("Amount,len,1");
    expect(RQL.hv("CustomField")).toBe("CustomField,hv,");
    expect(RQL.eq("IsActive", true)).toBe("IsActive,eq,true");
  });

  it("rejects unsupported operators and empty fields", () => {
    expect(() => RQL.filter("Name", "bad", "Ada")).toThrow(/Unsupported RQL operator/);
    expect(() => RQL.eq("", "Ada")).toThrow(/non-empty string/);
  });
});

describe("QueryParams", () => {
  it("emits WAPI names and merges aliases", () => {
    expect(new QueryParams({
      fields: ["TenantID", "Name"],
      embed: ["Contacts"],
      embeds: ["Property"],
      filter: RQL.eq("IsActive", true),
      filters: [RQL.ct("Name", "Smith")],
      pageNumber: 2,
      pageSize: 100,
      noContent: true,
      orderBy: ["Name DESC", "TenantID"],
      saveOptions: {
        IgnoreHardClose: true,
        SyncPrimaryContact: false,
      },
    }).toParams()).toEqual({
      fields: "TenantID,Name",
      embed: "Contacts,Property",
      filters: "IsActive,eq,true;Name,ct,Smith",
      pagenumber: 2,
      pagesize: 100,
      nocontent: "true",
      orderby: "Name DESC,TenantID",
      SaveOptions: "IgnoreHardClose,true;SyncPrimaryContact,false",
    });
  });

  it("accepts Python aliases, save-option strings/lists, and extras", () => {
    expect(new QueryParams({
      page_number: 3,
      page_size: 25,
      no_content: false,
      order_by: "Name",
      save_options: ["ValidateOnly,true", "SkipAutomation,false"],
      customFlag: "yes",
      extra: { propertyID: 9 },
    }).toParams()).toEqual({
      pagenumber: 3,
      pagesize: 25,
      nocontent: "false",
      orderby: "Name",
      SaveOptions: "ValidateOnly,true;SkipAutomation,false",
      customFlag: "yes",
      propertyID: 9,
    });
  });
});

describe("pagination helpers", () => {
  it("parses links and case-insensitive total-result headers", () => {
    expect(parseLinkHeader(
      '<https://example.test/a?page=2>; rel="next", <https://example.test/a?page=5>; rel="last", bad',
    )).toEqual({
      next: "https://example.test/a?page=2",
      last: "https://example.test/a?page=5",
    });
    expect(totalResultsFromHeaders({ "x-total-results": "41" })).toBe(41);
    expect(totalResultsFromHeaders({ "X-Total-Results": "many" })).toBeNull();
  });
});
