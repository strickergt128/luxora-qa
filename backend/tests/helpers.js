import { vi } from "vitest";

/** Respuesta de Express simulada: registra status, json y cookies. */
export function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  res.clearCookie = vi.fn(() => res);
  return res;
}

/** Solicitud de Express simulada. */
export function mockReq({ body = {}, params = {}, query = {}, headers = {}, user, authClaims } = {}) {
  return {
    body,
    params,
    query,
    headers,
    user,
    authClaims,
    ip: "127.0.0.1",
    get: (h) => headers[h.toLowerCase()],
  };
}

/**
 * Consulta de Mongoose simulada: se puede encadenar (.populate, .select, .sort,
 * .lean, .session) y al final se resuelve con `resultado`, como una promesa.
 */
export function consulta(resultado) {
  const q = {
    populate: vi.fn(() => q),
    select: vi.fn(() => q),
    sort: vi.fn(() => q),
    lean: vi.fn(() => q),
    session: vi.fn(() => q),
    then: (ok, err) => Promise.resolve(resultado).then(ok, err),
  };
  return q;
}

/** Carrito simulado con items que se pueden buscar como un subdocumento de Mongoose. */
export function carritoFalso(items = [], extra = {}) {
  const cart = {
    user: "u1",
    items: [...items],
    appliedCoupon: undefined,
    save: vi.fn(async () => cart),
    populate: vi.fn(async () => cart),
    ...extra,
  };
  cart.items.id = (id) => cart.items.find((i) => String(i._id) === String(id));
  return cart;
}
