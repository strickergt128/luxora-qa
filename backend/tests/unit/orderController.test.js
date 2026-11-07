import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReq, mockRes, consulta, carritoFalso } from "../helpers.js";

/*
 * DOBLES DE PRUEBA (mocks y stubs) — modelos, transacción de MongoDB y correo.
 * Por qué se aíslan:
 *  - Los modelos (Order, Cart, Coupon, Product, OrderStatusAudit, ReturnRequest) para fijar
 *    el estado del pedido, la existencia y el cupón sin una base de datos.
 *  - mongoose.startSession es un stub: placeOrder usa transacciones, que exigen un replica set.
 *  - El servicio de correo se reemplaza para no enviar correos reales desde las pruebas.
 *  - logOrderStatusChange se espía para verificar que cada cambio de estado queda auditado.
 */
vi.mock("../../src/models/Order.js", () => ({ default: { findById: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/models/Cart.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../../src/models/Coupon.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../../src/models/Product.js", () => ({ default: { updateOne: vi.fn() } }));
vi.mock("../../src/models/OrderStatusAudit.js", () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/models/ReturnRequest.js", () => ({ default: { find: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/services/email/emailService.js", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => {}),
  sendOrderDeliveredEmail: vi.fn(async () => {}),
}));
vi.mock("../../src/utils/audit.js", () => ({
  ALLOWED_ORDER_STATUSES: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
  logOrderStatusChange: vi.fn(async () => {}),
}));
vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(async () => ({
      withTransaction: async (fn) => fn(),
      endSession: async () => {},
    })),
  },
}));

import Order from "../../src/models/Order.js";
import Cart from "../../src/models/Cart.js";
import Coupon from "../../src/models/Coupon.js";
import Product from "../../src/models/Product.js";
import OrderStatusAudit from "../../src/models/OrderStatusAudit.js";
import ReturnRequest from "../../src/models/ReturnRequest.js";
import { logOrderStatusChange } from "../../src/utils/audit.js";
import { placeOrder, updateOrderStatus, createReturnRequest, getOrderById } from "../../src/controllers/orderController.js";

const usuario = { _id: "u1", role: "user" };
const direccion = { line1: "6a avenida 1-23", city: "Guatemala" };
const gemelos = { _id: "p3", title: "Gold Cuff Links", price: 450 };

beforeEach(() => {
  vi.mocked(Order.findById).mockReset();
  vi.mocked(Order.create).mockReset();
  vi.mocked(Cart.findOne).mockReset();
  vi.mocked(Coupon.findOne).mockReset();
  vi.mocked(Product.updateOne).mockReset();
  vi.mocked(OrderStatusAudit.findOne).mockReset();
  vi.mocked(ReturnRequest.find).mockReset();
  vi.mocked(ReturnRequest.create).mockReset();
  vi.mocked(logOrderStatusChange).mockClear();
});

/** Prepara un carrito con 2 gemelos (subtotal 900) y, opcionalmente, un cupón aplicado. */
function prepararPedido({ cupon = null, stockOk = true } = {}) {
  const cart = carritoFalso([{ product: gemelos, qty: 2, priceAtAdd: 450 }], {
    appliedCoupon: cupon ? { code: cupon.code } : undefined,
  });
  vi.mocked(Cart.findOne).mockReturnValue(consulta(cart));
  vi.mocked(Product.updateOne).mockResolvedValue({ modifiedCount: stockOk ? 1 : 0 });
  vi.mocked(Coupon.findOne).mockReturnValue(consulta(cupon ? { usedBy: [], save: vi.fn(), ...cupon } : null));
  vi.mocked(Order.create).mockImplementation(async (docs) => [{ _id: "o1", ...docs[0] }]);
  vi.mocked(Order.findById).mockReturnValue(consulta({ _id: "o1" }));
  return cart;
}
const pedidoCreado = () => vi.mocked(Order.create).mock.calls[0][0][0];

describe("controllers/orderController — crear pedido (RF-08, RF-09)", () => {
  it("responde 400 si falta la dirección de envío", async () => {
    const res = mockRes();
    await placeOrder(mockReq({ user: usuario, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Address required" });
  });

  it("responde 400 si el carrito está vacío", async () => {
    vi.mocked(Cart.findOne).mockReturnValue(consulta(carritoFalso([])));
    const res = mockRes();
    await placeOrder(mockReq({ user: usuario, body: { address: direccion } }), res);
    expect(res.json).toHaveBeenCalledWith({ message: "Cart is empty" });
  });

  it("CP-19: con envío express y cupón fijo calcula descuento, impuesto del 5 % y total", async () => {
    const cart = prepararPedido({ cupon: { code: "FIX100", active: true, type: "fixed", value: 100, usedCount: 0 } });
    const res = mockRes();
    await placeOrder(mockReq({ user: usuario, body: { address: direccion, shippingMethod: "express" } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    // subtotal 900 − 100 = 800; impuesto round(800 × 0.05) = 40; envío 99; total 939
    expect(pedidoCreado()).toMatchObject({
      subtotal: 900, tax: 40, shippingCost: 99, totalAmount: 939, status: "pending", paymentMethod: "COD",
      appliedCoupon: { code: "FIX100", discountAmount: 100 },
    });
    expect(cart.items).toHaveLength(0); // el carrito se vacía
    expect(logOrderStatusChange).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toStatus: "pending" }));
  });

  it("CP-20: responde 400 si un producto ya no tiene existencia suficiente", async () => {
    prepararPedido({ stockOk: false });
    const res = mockRes();
    await placeOrder(mockReq({ user: usuario, body: { address: direccion } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Not enough stock for Gold Cuff Links" });
    expect(Order.create).not.toHaveBeenCalled();
  });

  // DEF-04 (abierto): la condición !coupon.usageLimit trata el límite 0 como "sin límite".
  it.fails("CP-21 / DEF-04: no aplica un cupón cuyo límite global es 0", async () => {
    prepararPedido({ cupon: { code: "LIM0", active: true, type: "fixed", value: 100, usageLimit: 0, usedCount: 0 } });
    await placeOrder(mockReq({ user: usuario, body: { address: direccion } }), mockRes());
    expect(pedidoCreado().appliedCoupon).toBeUndefined();
  });
});

describe("controllers/orderController — estados del pedido (RF-10)", () => {
  const pedido = (status) => ({ _id: "o1", status, user: { _id: "u1" }, save: vi.fn() });

  it("rechaza un estado que no existe", async () => {
    const res = mockRes();
    await updateOrderStatus(mockReq({ params: { id: "o1" }, body: { status: "lost" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid status" });
  });

  it("CP-22: pending → confirmed se guarda y queda en la bitácora de auditoría", async () => {
    const o = pedido("pending");
    vi.mocked(Order.findById).mockReturnValue(consulta(o));
    const res = mockRes();
    await updateOrderStatus(mockReq({ params: { id: "o1" }, body: { status: "confirmed" } }), res);
    expect(o.save).toHaveBeenCalledOnce();
    expect(logOrderStatusChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromStatus: "pending", toStatus: "confirmed", context: "admin" })
    );
  });

  // DEF-05 (abierto): no existe una tabla de transiciones; cualquier estado se acepta.
  it.fails("CP-23 / DEF-05: rechaza regresar un pedido delivered a pending", async () => {
    vi.mocked(Order.findById).mockReturnValue(consulta(pedido("delivered")));
    const res = mockRes();
    await updateOrderStatus(mockReq({ params: { id: "o1" }, body: { status: "pending" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("getOrderById responde 403 si el pedido es de otro usuario", async () => {
    vi.mocked(Order.findById).mockReturnValue(consulta({ _id: "o1", user: "otro" }));
    const res = mockRes();
    await getOrderById(mockReq({ user: usuario, params: { id: "o1" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("controllers/orderController — devoluciones (RF-11)", () => {
  const entregadoHace = (dias) => {
    const fecha = new Date(Date.now() - dias * 864e5);
    vi.mocked(Order.findById).mockReturnValue(
      consulta({ _id: "o1", user: "u1", status: "delivered", createdAt: fecha, items: [{ product: "p3", qty: 2, price: 450 }] })
    );
    vi.mocked(OrderStatusAudit.findOne).mockReturnValue(consulta({ createdAt: fecha }));
    vi.mocked(ReturnRequest.find).mockReturnValue(consulta([]));
  };
  const solicitar = async (items) => {
    const res = mockRes();
    await createReturnRequest(mockReq({ user: usuario, params: { id: "o1" }, body: { items, reason: "Defecto" } }), res);
    return res;
  };

  it("CP-26: acepta devolver todas las unidades dentro de los 7 días", async () => {
    entregadoHace(2);
    vi.mocked(ReturnRequest.create).mockImplementation(async (d) => d);
    const res = await solicitar([{ product: "p3", qty: 2 }]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(ReturnRequest.create).toHaveBeenCalledWith(expect.objectContaining({ status: "requested", items: [{ product: "p3", qty: 2, price: 450 }] }));
  });

  it("CP-28: rechaza devolver más unidades que las compradas", async () => {
    entregadoHace(2);
    const res = await solicitar([{ product: "p3", qty: 3 }]);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Requested quantity exceeds available returnable quantity" });
  });

  it("rechaza la devolución cuando pasaron más de 7 días desde la entrega", async () => {
    entregadoHace(8);
    const res = await solicitar([{ product: "p3", qty: 1 }]);
    expect(res.json).toHaveBeenCalledWith({ message: "Return window expired" });
  });

  // DEF-08 (abierto): sin registro de entrega, toma la fecha de creación y no revisa el estado.
  it.fails("CP-27 / DEF-08: rechaza la devolución de un pedido pending", async () => {
    vi.mocked(Order.findById).mockReturnValue(
      consulta({ _id: "o1", user: "u1", status: "pending", createdAt: new Date(), items: [{ product: "p3", qty: 2, price: 450 }] })
    );
    vi.mocked(OrderStatusAudit.findOne).mockReturnValue(consulta(null));
    vi.mocked(ReturnRequest.find).mockReturnValue(consulta([]));
    vi.mocked(ReturnRequest.create).mockImplementation(async (d) => d);
    const res = await solicitar([{ product: "p3", qty: 1 }]);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
