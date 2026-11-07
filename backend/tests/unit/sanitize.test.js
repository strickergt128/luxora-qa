import { describe, it, expect } from "vitest";
import { asText } from "../../src/utils/sanitize.js";

describe("utils/sanitize — prevención de inyección NoSQL (hallazgos Blocker de Sonar)", () => {
  it("un objeto con operadores de MongoDB deja de ser un operador y se vuelve texto", () => {
    const ataque = { $ne: null };
    expect(asText(ataque)).toBe("[object Object]");
    expect(typeof asText({ $gt: "" })).toBe("string");
  });

  it("conserva los textos y números válidos, toma el primer valor de un arreglo y vacía null/undefined", () => {
    expect(asText("user@luxora.com")).toBe("user@luxora.com");
    expect(asText(42)).toBe("42");
    expect(asText(["pending", "delivered"])).toBe("pending");
    expect(asText(undefined)).toBe("");
    expect(asText(null)).toBe("");
  });
});
