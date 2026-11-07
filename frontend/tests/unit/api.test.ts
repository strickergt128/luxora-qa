import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * DOBLES DE PRUEBA — store de Redux y adaptador HTTP de axios.
 * Por qué se aíslan: el cliente api.ts lee el token del store y, ante un 401, pide uno
 * nuevo a /auth/refresh. Con un store falso se controla qué token hay y se verifica qué
 * acciones se despachan; con un adaptador falso se fijan las respuestas sin red.
 */
const estado = { auth: { user: { accessToken: "tok-viejo" } as { accessToken?: string } | null } };
vi.mock("../../src/store", () => ({
  default: {
    getState: () => estado,
    // Igual que el store real: setAccessToken reemplaza el token de la sesión.
    dispatch: vi.fn((accion: { type: string; payload?: string }) => {
      if (accion.type === "auth/setAccessToken" && estado.auth.user) estado.auth.user.accessToken = accion.payload;
    }),
  },
}));
vi.mock("../../src/store/slices/authSlice", () => ({
  setAccessToken: (t: string) => ({ type: "auth/setAccessToken", payload: t }),
  logout: () => ({ type: "auth/logout" }),
}));

import store from "../../src/store";
import api from "../../src/utils/api";

type Config = { url?: string; headers: Record<string, string> };
const llamadas: Config[] = [];
const respuesta = (config: Config, status: number, data: unknown = {}) => {
  const res = { data, status, statusText: "", headers: {}, config };
  if (status >= 400) return Promise.reject(Object.assign(new Error(String(status)), { response: res, config }));
  return Promise.resolve(res);
};
/** Instala un adaptador que responde según la URL y guarda cada solicitud. */
function servidor(manejar: (c: Config) => Promise<unknown>) {
  api.defaults.adapter = ((c: Config) => {
    llamadas.push({ url: c.url, headers: { ...c.headers } });
    return manejar(c);
  }) as never;
}

beforeEach(() => {
  llamadas.length = 0;
  estado.auth.user = { accessToken: "tok-viejo" };
  vi.mocked(store.dispatch).mockClear();
});

describe("utils/api — cliente HTTP con renovación de token (RF-03)", () => {
  it("agrega el token de acceso del store en la cabecera Authorization", async () => {
    servidor((c) => respuesta(c, 200, { ok: true }));
    await api.get("/cart");
    expect(llamadas[0].headers.Authorization).toBe("Bearer tok-viejo");
  });

  it("no agrega Authorization cuando no hay sesión", async () => {
    estado.auth.user = null;
    servidor((c) => respuesta(c, 200));
    await api.get("/products");
    expect(llamadas[0].headers.Authorization).toBeUndefined();
  });

  it("ante un 401 renueva el token, lo guarda en el store y repite la solicitud original", async () => {
    let primera = true;
    servidor((c) => {
      if (c.url === "/auth/refresh") return respuesta(c, 200, { accessToken: "tok-nuevo" });
      if (primera) { primera = false; return respuesta(c, 401); }
      return respuesta(c, 200, { items: [] });
    });
    const res = await api.get("/cart");
    expect(res.data).toEqual({ items: [] });
    expect(store.dispatch).toHaveBeenCalledWith({ type: "auth/setAccessToken", payload: "tok-nuevo" });
    expect(llamadas.map((l) => l.url)).toEqual(["/cart", "/auth/refresh", "/cart"]);
    expect(llamadas[2].headers.Authorization).toBe("Bearer tok-nuevo");
  });

  it("si la renovación falla, cierra la sesión y rechaza la solicitud", async () => {
    servidor((c) => respuesta(c, 401));
    await expect(api.get("/orders")).rejects.toBeTruthy();
    expect(store.dispatch).toHaveBeenCalledWith({ type: "auth/logout" });
  });

  it("un 401 del propio login no intenta renovar el token", async () => {
    servidor((c) => respuesta(c, 401, { message: "Invalid credentials" }));
    await expect(api.post("/auth/login", {})).rejects.toBeTruthy();
    expect(llamadas.map((l) => l.url)).toEqual(["/auth/login"]);
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
