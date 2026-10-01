import { describe, expect, it } from "vitest";
import { toPersistenceRow } from "./persistence.js";

describe("business import persistence", () => {
  it("creates a business-scoped sales row and preserves provenance", () => {
    const row = toPersistenceRow(
      "11111111-1111-4111-8111-111111111111",
      "sales",
      {
        type: "sale",
        id: "csv-row-1",
        externalId: "invoice-1",
        occurredAt: "2026-09-30T10:00:00.000Z",
        amount: 700,
        currency: "NGN",
        customerId: "customer-name",
        productId: "product-name",
        quantity: 1,
        source: "user-import",
      },
      "batch-1",
    );

    expect(row.business_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(row.amount).toBe(700);
    expect(row.customer_id).toBeNull();
    expect(row.product_id).toBeNull();
    expect(row.external_id).toBe("invoice-1");
    expect(row.metadata).toMatchObject({
      importBatchId: "batch-1",
      normalizedRecordId: "csv-row-1",
    });
  });

  it("rejects a record/domain mismatch", () => {
    expect(() => toPersistenceRow(
      "11111111-1111-4111-8111-111111111111",
      "sales",
      {
        type: "customer",
        id: "row-1",
        name: "A",
        source: "user-import",
        observedAt: "2026-09-30T10:00:00.000Z",
      },
      "batch-1",
    )).toThrow("Record/domain mismatch.");
  });
});
