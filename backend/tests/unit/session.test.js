import { describe, it, expect } from "vitest";
import { clientIp, sessionOf, ymdUTC } from "../../src/utils/session.js";

const req = ({ headers = {}, cookies = {}, ip } = {}) => ({ headers, cookies, ip, get: (h) => headers[h.toLowerCase()] });

describe("utils/session — identificador de sesión para analítica", () => {
  it("clientIp toma la primera IP de X-Forwarded-For, o la de la conexión", () => {
    expect(clientIp(req({ headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1" } }))).toBe("200.1.2.3");
    expect(clientIp(req({ headers: { "x-forwarded-for": ["190.5.6.7"] } }))).toBe("190.5.6.7");
    expect(clientIp(req({ ip: "127.0.0.1" }))).toBe("127.0.0.1");
    expect(clientIp(req())).toBe("unknown");
  });

  it("sessionOf usa la cookie sid y siempre devuelve texto, aunque la cookie traiga un objeto", () => {
    expect(sessionOf(req({ cookies: { sid: "abc123" } }))).toBe("abc123");
    expect(typeof sessionOf(req({ cookies: { sid: { $ne: null } } }))).toBe("string");
    expect(sessionOf(req({ ip: "1.2.3.4", headers: { "user-agent": "Mozilla/5.0" } }))).toBe("1.2.3.4|Mozilla/5.0");
  });

  it("ymdUTC formatea la fecha como AAAA-MM-DD en UTC", () => {
    expect(ymdUTC(new Date(Date.UTC(2026, 10, 6, 23, 59)))).toBe("2026-11-06");
  });
});
