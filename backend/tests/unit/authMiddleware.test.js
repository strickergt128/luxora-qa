import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReq, mockRes, consulta } from "../helpers.js";

/*
 * DOBLE DE PRUEBA (mock) — modelo User.
 * Por qué se aísla: protect() consulta MongoDB para cargar al usuario del token.
 * Una prueba unitaria debe verificar solo la regla del middleware (token, versión,
 * estado bloqueado), sin depender de una base de datos ni de datos sembrados.
 */
vi.mock("../../src/models/User.js", () => ({ default: { findById: vi.fn() } }));

import User from "../../src/models/User.js";
import { protect, authorizeRoles, attachUserIfPresent } from "../../src/middleware/authMiddleware.js";
import { signAccessToken } from "../../src/utils/token.js";

const cabecera = (u) => ({ authorization: `Bearer ${signAccessToken(u)}` });

describe("middleware/authMiddleware — protect (RF-03, RNF-06)", () => {
  beforeEach(() => vi.mocked(User.findById).mockReset());

  it("responde 401 si la solicitud no trae token", async () => {
    const res = mockRes();
    const next = vi.fn();
    await protect(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("deja pasar un token válido de una cuenta activa y adjunta el usuario", async () => {
    const usuario = { _id: "u1", role: "user", tokenVersion: 0, status: "active" };
    vi.mocked(User.findById).mockReturnValue(consulta(usuario));
    const req = mockReq({ headers: cabecera(usuario) });
    const next = vi.fn();
    await protect(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBe(usuario);
    expect(req.authClaims).toMatchObject({ id: "u1", role: "user" });
  });

  it("responde 401 'Token revoked' si la versión del token ya no coincide (cierre de sesiones)", async () => {
    const usuario = { _id: "u1", role: "user", tokenVersion: 0 };
    vi.mocked(User.findById).mockReturnValue(consulta({ ...usuario, tokenVersion: 1 }));
    const res = mockRes();
    await protect(mockReq({ headers: cabecera(usuario) }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token revoked" });
  });

  it("responde 403 si la cuenta está bloqueada", async () => {
    const usuario = { _id: "u1", role: "user", tokenVersion: 0, status: "blocked" };
    vi.mocked(User.findById).mockReturnValue(consulta(usuario));
    const res = mockRes();
    await protect(mockReq({ headers: cabecera(usuario) }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("responde 401 'Token invalid' si el token está alterado", async () => {
    const res = mockRes();
    await protect(mockReq({ headers: { authorization: "Bearer xxx.yyy.zzz" } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token invalid" });
  });
});

describe("middleware/authMiddleware — authorizeRoles y attachUserIfPresent", () => {
  it("authorizeRoles responde 403 a un rol no permitido y deja pasar al permitido", () => {
    const soloAdmin = authorizeRoles("admin");
    const res = mockRes();
    const next = vi.fn();
    soloAdmin(mockReq({ user: { role: "user" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    soloAdmin(mockReq({ user: { role: "admin" } }), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("attachUserIfPresent continúa sin usuario cuando el token es inválido", async () => {
    const req = mockReq({ headers: { authorization: "Bearer malo" } });
    const next = vi.fn();
    await attachUserIfPresent(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });
});
