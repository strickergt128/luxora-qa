import { describe, it, expect, vi } from "vitest";
import { mockReq, mockRes, consulta } from "../helpers.js";

// Doble del modelo User: withSellerScope busca en BD al vendedor al que está ligado un asistente.
vi.mock("../../src/models/User.js", () => ({ default: { findById: vi.fn() } }));

import User from "../../src/models/User.js";
import {
  requirePermissions,
  requireSellerPermissions,
  requireAdminMFA,
  requireApprovedSeller,
  withSellerScope,
} from "../../src/middleware/roleMiddleware.js";

describe("middleware/roleMiddleware — autorización por rol (RF-04 d, RF-10 d, RNF-06)", () => {
  it("requirePermissions: el admin siempre pasa y el subadmin necesita todos los permisos", () => {
    const mw = requirePermissions("orders:write", "orders:read");
    const next = vi.fn();
    mw(mockReq({ user: { role: "admin" } }), mockRes(), next);
    mw(mockReq({ user: { role: "subadmin", permissions: ["orders:write", "orders:read"] } }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);

    const res = mockRes();
    mw(mockReq({ user: { role: "subadmin", permissions: ["orders:read"] } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Insufficient permissions" });
  });

  it("requirePermissions: un comprador recibe 403 y una solicitud sin usuario recibe 401", () => {
    const mw = requirePermissions("orders:read");
    const r1 = mockRes();
    mw(mockReq({ user: { role: "user" } }), r1, vi.fn());
    expect(r1.status).toHaveBeenCalledWith(403);
    const r2 = mockRes();
    mw(mockReq(), r2, vi.fn());
    expect(r2.status).toHaveBeenCalledWith(401);
  });

  it("requireAdminMFA exige el claim mfa para admin y subadmin", () => {
    const next = vi.fn();
    const sinMfa = mockRes();
    requireAdminMFA(mockReq({ user: { role: "admin" }, authClaims: {} }), sinMfa, next);
    expect(sinMfa.status).toHaveBeenCalledWith(403);
    expect(sinMfa.json).toHaveBeenCalledWith({ message: "Admin 2FA required" });

    requireAdminMFA(mockReq({ user: { role: "subadmin" }, authClaims: { mfa: true } }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();

    const comprador = mockRes();
    requireAdminMFA(mockReq({ user: { role: "user" } }), comprador, next);
    expect(comprador.json).toHaveBeenCalledWith({ message: "Admin only" });
  });

  it("requireApprovedSeller rechaza a un vendedor no aprobado", () => {
    const res = mockRes();
    requireApprovedSeller()(mockReq({ user: { role: "seller", seller: { approved: false } } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Seller account not approved" });
  });

  it("requireSellerPermissions: el asistente necesita los permisos y el vendedor pasa directo", () => {
    const mw = requireSellerPermissions("products:write");
    const next = vi.fn();
    mw(mockReq({ user: { role: "seller" } }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    const res = mockRes();
    mw(mockReq({ user: { role: "seller_assistant", permissions: [] } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("withSellerScope: un asistente ligado a un vendedor aprobado queda limitado a ese vendedor", async () => {
    vi.mocked(User.findById).mockReturnValue(consulta({ _id: "s1", role: "seller", seller: { approved: true } }));
    const req = mockReq({ user: { role: "seller_assistant", assistantFor: "s1" } });
    const next = vi.fn();
    await withSellerScope()(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.sellerId).toBe("s1");
  });

  it("withSellerScope: un admin debe indicar sellerId", async () => {
    const res = mockRes();
    await withSellerScope()(mockReq({ user: { role: "admin" } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
