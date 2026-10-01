import { describe, expect, it } from "vitest";
import { importRows, inferImportMapping } from "./import.js";

describe("business data import", () => {
  it("infers common sales columns and normalizes records", () => {
    const headers = ["Date", "Revenue", "Currency", "Customer", "Qty"];
    const mapping = inferImportMapping(headers, "sales");
    const result = importRows([
      { Date: "2026-09-29", Revenue: "1,500", Currency: "NGN", Customer: "c-1", Qty: "2" },
    ], mapping, "csv:test");

    expect(mapping.columns.amount).toBe("Revenue");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      type: "sale",
      amount: 1500,
      currency: "NGN",
      customerId: "c-1",
      quantity: 2,
      source: "csv:test",
    });
    expect(result.issues).toHaveLength(0);
  });

  it("rejects malformed rows instead of inventing values", () => {
    const mapping = inferImportMapping(["Date", "Revenue"], "sales");
    const result = importRows([{ Date: "2026-09-29", Revenue: "not-a-number" }], mapping);

    expect(result.records).toHaveLength(0);
    expect(result.issues).toEqual([
      { row: 2, field: "amount", message: "Amount must be a number." },
    ]);
  });

  it("keeps possibilities separate from imported actual records", () => {
    const mapping = inferImportMapping(["Date", "Revenue"], "sales");
    const result = importRows([{ Date: "2026-09-29", Revenue: "1000" }], mapping);

    expect(result.records[0].type).toBe("sale");
    expect(result.records[0].source).toBe("user-import");
  });
});
