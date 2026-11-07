/**
 * Convierte un valor recibido del cliente (body, query, params o cookies) en texto plano
 * antes de usarlo en una consulta de MongoDB.
 *
 * Evita la inyección NoSQL: si el cliente envía un objeto como { "$ne": null } en lugar de
 * un texto, deja de interpretarse como operador de consulta y se convierte en "[object Object]".
 */
export const asText = (value) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value);
};
