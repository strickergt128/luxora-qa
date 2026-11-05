import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

// Doble del cliente HTTP: el login y el registro se prueban sin llamar al backend.
vi.mock("../../src/utils/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from "../../src/utils/api";
import reducer, { login, register, logout, setAccessToken, loginSuccess } from "../../src/store/slices/authSlice";

const crearStore = () => configureStore({ reducer: { auth: reducer } });
const usuario = { _id: "u1", name: "Cliente", email: "user@luxora.com", role: "user" as const };

beforeEach(() => vi.clearAllMocks());

describe("store/slices/authSlice — sesión en el frontend (RF-03, RF-04)", () => {
  it("login exitoso guarda el usuario con su token de acceso", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { user: usuario, accessToken: "tok-1" } });
    const store = crearStore();
    await store.dispatch(login({ email: usuario.email, password: "Clave123" }));
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: usuario.email, password: "Clave123" });
    expect(store.getState().auth).toMatchObject({ user: { _id: "u1", accessToken: "tok-1" }, loading: false, error: null });
  });

  it("si el servidor pide el segundo factor, guarda el reto y no inicia sesión", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { twoFARequired: true, challenge: "reto-123" } });
    const store = crearStore();
    await store.dispatch(login({ email: "admin@luxora.com", password: "Clave123" }));
    expect(store.getState().auth).toMatchObject({ user: null, error: null, mfa: { mode: "verify", challenge: "reto-123" } });
  });

  it("con credenciales incorrectas guarda el mensaje del servidor", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: "Invalid credentials" } } });
    const store = crearStore();
    await store.dispatch(login({ email: usuario.email, password: "mala" }));
    expect(store.getState().auth).toMatchObject({ user: null, error: "Invalid credentials" });
  });

  it("register exitoso deja la sesión iniciada; si falla, guarda el motivo", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: usuario, accessToken: "tok-2" } });
    const store = crearStore();
    await store.dispatch(register({ name: "Cliente", email: usuario.email, password: "Clave123" }));
    expect(store.getState().auth.user?.accessToken).toBe("tok-2");

    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Email already used" } } });
    await store.dispatch(register({ name: "Cliente", email: usuario.email, password: "Clave123" }));
    expect(store.getState().auth.error).toBe("Email already used");
  });

  it("setAccessToken solo actualiza el token si hay una sesión, y logout la cierra", () => {
    let estado = reducer(undefined, setAccessToken("sin-sesion"));
    expect(estado.user).toBeNull();
    estado = reducer(estado, loginSuccess({ ...usuario, accessToken: "viejo" }));
    estado = reducer(estado, setAccessToken("nuevo"));
    expect(estado.user?.accessToken).toBe("nuevo");
    estado = reducer(estado, logout());
    expect(estado).toMatchObject({ user: null, hydrated: true, mfa: { mode: null, challenge: null } });
  });
});
