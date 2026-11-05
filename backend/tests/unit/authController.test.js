import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReq, mockRes } from "../helpers.js";

/*
 * DOBLES DE PRUEBA — User, RefreshToken, bcrypt y correo.
 * Por qué se aíslan:
 *  - User y RefreshToken: el registro y el login consultan y guardan en MongoDB.
 *  - bcrypt (stub): permite fijar si la contraseña coincide sin calcular hashes reales,
 *    que son lentos a propósito; la regla que se prueba es la decisión del controlador.
 *  - emailService: el registro envía un correo de bienvenida que no debe salir de la prueba.
 */
vi.mock("../../src/models/User.js", () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/models/RefreshToken.js", () => ({ default: { create: vi.fn(async (d) => d) } }));
vi.mock("../../src/models/PasswordResetToken.js", () => ({ default: {} }));
vi.mock("bcrypt", () => ({ default: { compare: vi.fn() } }));
vi.mock("../../src/services/email/emailService.js", () => ({
  sendWelcomeEmail: vi.fn(async () => {}),
  sendPasswordResetEmail: vi.fn(async () => {}),
}));

import User from "../../src/models/User.js";
import bcrypt from "bcrypt";
import { registerUser, loginUser } from "../../src/controllers/authController.js";
import { verifyAccessToken, verifyMFAChallenge } from "../../src/utils/token.js";

const doc = (datos) => ({ _id: "u9", tokenVersion: 0, status: "active", ...datos, toObject() { return { ...this }; } });

beforeEach(() => {
  vi.mocked(User.findOne).mockReset();
  vi.mocked(User.create).mockReset();
  vi.mocked(bcrypt.compare).mockReset();
});

describe("controllers/authController — registro (RF-01, RF-02)", () => {
  it("responde 400 si falta algún campo obligatorio", async () => {
    const res = mockRes();
    await registerUser(mockReq({ body: { email: "a@b.com", password: "Clave123" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "All fields required" });
  });

  it("CP-02: responde 400 si el correo ya está registrado", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ email: "user@luxora.com" }));
    const res = mockRes();
    await registerUser(mockReq({ body: { name: "Cliente", email: "user@luxora.com", password: "Clave123" } }), res);
    expect(res.json).toHaveBeenCalledWith({ message: "Email already used" });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("CP-04: aunque se envíe role admin, crea la cuenta como comprador", async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockImplementation(async (d) => doc(d));
    const res = mockRes();
    await registerUser(mockReq({ body: { name: "Rol Admin", email: "roladmin@luxora.com", password: "Clave123", role: "admin" } }), res);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("CP-01: un registro válido devuelve el token de acceso, la cookie de renovación y no expone la contraseña", async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockImplementation(async (d) => doc({ ...d, password: "$2b$10$hash" }));
    const res = mockRes();
    await registerUser(mockReq({ body: { name: "Nuevo", email: "nuevo@luxora.com", password: "Clave1", role: "seller" } }), res);
    const cuerpo = res.json.mock.calls[0][0];
    expect(verifyAccessToken(cuerpo.accessToken)).toMatchObject({ role: "seller" });
    expect(cuerpo.user.password).toBeUndefined();
    expect(res.cookie).toHaveBeenCalledWith("rt", expect.any(String), expect.objectContaining({ httpOnly: true }));
  });

  // DEF-01 (abierto): la API no valida la longitud mínima de 6 caracteres.
  it.fails("CP-03 / DEF-01: rechaza una contraseña de 5 caracteres", async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockImplementation(async (d) => doc(d));
    const res = mockRes();
    await registerUser(mockReq({ body: { name: "Corta", email: "corta@luxora.com", password: "Cl123" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("controllers/authController — inicio de sesión (RF-03, RF-04)", () => {
  it("CP-06: con contraseña incorrecta responde 400 'Invalid credentials'", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ role: "user", password: "h" }));
    vi.mocked(bcrypt.compare).mockResolvedValue(false);
    const res = mockRes();
    await loginUser(mockReq({ body: { email: "user@luxora.com", password: "mala" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid credentials" });
  });

  it("CP-07: una cuenta bloqueada recibe 403 aunque la contraseña sea correcta", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ role: "user", status: "blocked" }));
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    const res = mockRes();
    await loginUser(mockReq({ body: { email: "bloqueado@luxora.com", password: "Clave123" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("CP-05: un comprador activo recibe token de acceso y cookie de renovación", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ role: "user" }));
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    const res = mockRes();
    await loginUser(mockReq({ body: { email: "user@luxora.com", password: "Clave123" } }), res);
    const cuerpo = res.json.mock.calls[0][0];
    expect(verifyAccessToken(cuerpo.accessToken)).toMatchObject({ id: "u9", role: "user" });
    expect(res.cookie).toHaveBeenCalledOnce();
  });

  it("un admin con 2FA activo recibe un reto y ningún token de acceso", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ role: "admin", twoFA: { enabled: true } }));
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    const res = mockRes();
    await loginUser(mockReq({ body: { email: "admin@luxora.com", password: "Clave123" } }), res);
    const cuerpo = res.json.mock.calls[0][0];
    expect(cuerpo.twoFARequired).toBe(true);
    expect(cuerpo.accessToken).toBeUndefined();
    expect(verifyMFAChallenge(cuerpo.challenge)).toMatchObject({ uid: "u9", stage: "verify" });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("un subadmin sin 2FA recibe un reto de enrolamiento", async () => {
    vi.mocked(User.findOne).mockResolvedValue(doc({ role: "subadmin", twoFA: { enabled: false } }));
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    const res = mockRes();
    await loginUser(mockReq({ body: { email: "sub@luxora.com", password: "Clave123" } }), res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ twoFAEnrollRequired: true });
  });
});
