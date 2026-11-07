import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  signAccessToken,
  verifyAccessToken,
  signMFAChallenge,
  verifyMFAChallenge,
  createOpaqueToken,
  hashToken,
  setRefreshTokenCookie,
  REFRESH_TOKEN_TTL_MS,
} from "../../src/utils/token.js";

const usuario = { _id: "u1", role: "user", tokenVersion: 2 };

describe("utils/token — tokens de acceso y renovación (RF-03, RF-04)", () => {
  it("firma un token de acceso con id, rol y versión, y lo verifica con el mismo secreto", () => {
    const token = signAccessToken(usuario);
    const datos = verifyAccessToken(token);
    expect(datos).toMatchObject({ id: "u1", role: "user", v: 2 });
    expect(datos.mfa).toBeUndefined();
    // Vigencia de 15 minutos (RF-03 a)
    expect(datos.exp - datos.iat).toBe(15 * 60);
  });

  it("agrega el claim mfa solo cuando se pasó el segundo factor", () => {
    const datos = verifyAccessToken(signAccessToken({ ...usuario, role: "admin" }, { mfa: true }));
    expect(datos.mfa).toBe(true);
  });

  it("lanza un error si falta JWT_ACCESS_SECRET", () => {
    const original = process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    try {
      expect(() => signAccessToken(usuario)).toThrow("JWT_ACCESS_SECRET is not configured");
    } finally {
      process.env.JWT_ACCESS_SECRET = original;
    }
  });

  it("rechaza un token firmado con otro secreto", () => {
    const falso = jwt.sign({ id: "u1" }, "otro-secreto");
    expect(() => verifyAccessToken(falso)).toThrow();
  });

  it("firma y verifica el reto de segundo factor con su propio secreto", () => {
    const reto = signMFAChallenge({ uid: "a1", stage: "verify" });
    expect(verifyMFAChallenge(reto)).toMatchObject({ uid: "a1", stage: "verify" });
    expect(() => verifyAccessToken(reto)).toThrow();
  });

  it("genera tokens opacos aleatorios y guarda solo su hash SHA-256", () => {
    const a = createOpaqueToken();
    const b = createOpaqueToken();
    expect(a).toHaveLength(128);
    expect(a).not.toBe(b);
    expect(hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });

  it("guarda el token de renovación en una cookie httpOnly 'rt' de 30 días", () => {
    const res = { cookie: vi.fn() };
    setRefreshTokenCookie(res, "abc");
    expect(REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(res.cookie).toHaveBeenCalledWith(
      "rt",
      "abc",
      expect.objectContaining({ httpOnly: true, maxAge: REFRESH_TOKEN_TTL_MS, path: "/" })
    );
  });
});
