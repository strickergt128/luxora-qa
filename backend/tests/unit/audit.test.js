import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub del modelo de auditoría: se verifica qué se registra, no que MongoDB lo guarde.
vi.mock("../../src/models/OrderStatusAudit.js", () => ({ default: { create: vi.fn() } }));

import OrderStatusAudit from "../../src/models/OrderStatusAudit.js";
import { logOrderStatusChange, ALLOWED_ORDER_STATUSES } from "../../src/utils/audit.js";

beforeEach(() => vi.mocked(OrderStatusAudit.create).mockClear().mockResolvedValue({}));

describe("utils/audit — bitácora de cambios de estado (RF-10)", () => {
  it("define los cinco estados válidos del pedido", () => {
    expect(ALLOWED_ORDER_STATUSES).toEqual(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
  });

  it("registra quién hizo el cambio, desde dónde y entre qué estados", async () => {
    const req = {
      user: { _id: "a1", role: "admin" },
      headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1" },
      get: () => "Mozilla/5.0",
    };
    await logOrderStatusChange(req, { orderId: "o1", fromStatus: "pending", toStatus: "confirmed", context: "admin" });
    expect(OrderStatusAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order: "o1", fromStatus: "pending", toStatus: "confirmed",
        changedBy: "a1", changedByRole: "admin",
        meta: { ip: "200.1.2.3", ua: "Mozilla/5.0" },
      })
    );
  });

  it("no registra nada si falta el pedido o el estado destino", async () => {
    await logOrderStatusChange({}, { orderId: "o1" });
    expect(OrderStatusAudit.create).not.toHaveBeenCalled();
  });

  it("si la base de datos falla, no interrumpe el flujo principal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(OrderStatusAudit.create).mockImplementationOnce(async () => {
      throw new Error("db caída");
    });
    const resultado = await logOrderStatusChange({}, { orderId: "o1", toStatus: "shipped" });
    expect(resultado).toBeUndefined();
    expect(OrderStatusAudit.create).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[audit] failed to log order status change:", "db caída");
  });
});
