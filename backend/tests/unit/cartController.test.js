import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReq, mockRes, consulta, carritoFalso } from "../helpers.js";

/*
 * DOBLES DE PRUEBA (mocks) — modelos Cart, Product y Coupon.
 * Por qué se aíslan: las reglas de RF-05 a RF-07 (existencia, mínimo del cupón,
 * tope del descuento, alcance por categoría) son cálculos del controlador. Con los
 * modelos simulados cada prueba fija exactamente la existencia, el precio y el cupón
 * que necesita, sin MongoDB y sin que una prueba afecte a otra.
 */
vi.mock("../../src/models/Cart.js", () => ({ default: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/models/Product.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../../src/models/Coupon.js", () => ({ default: { findOne: vi.fn() } }));

import Cart from "../../src/models/Cart.js";
import Product from "../../src/models/Product.js";
import Coupon from "../../src/models/Coupon.js";
import { addToCart, updateCartItem, applyCoupon, getCart } from "../../src/controllers/cartController.js";

const usuario = { _id: "u1", role: "user" };
const maletin = { _id: "p1", title: "Midnight Leather Briefcase", price: 2100, stock: 10, category: "Bags" };
const dije = { _id: "p2", title: "Geometric Gold Pendant", price: 8900, stock: 5, category: "Jewelry" };
const item = (producto, qty, extra = {}) => ({
  _id: `i-${producto._id}`,
  product: { ...producto, toString: () => producto._id },
  qty,
  priceAtAdd: producto.price,
  ...extra,
});
const cupon = (datos) => ({ active: true, usedCount: 0, usedBy: [], ...datos });

beforeEach(() => vi.resetAllMocks());

describe("controllers/cartController — agregar al carrito (RF-05)", () => {
  it("responde 404 si el producto no existe", async () => {
    vi.mocked(Product.findById).mockResolvedValue(null);
    const res = mockRes();
    await addToCart(mockReq({ user: usuario, body: { productId: "x", qty: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("CP-11: rechaza una cantidad mayor a la existencia con 'Not enough stock'", async () => {
    vi.mocked(Product.findById).mockResolvedValue(dije);
    const res = mockRes();
    await addToCart(mockReq({ user: usuario, body: { productId: "p2", qty: 6 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Not enough stock" });
  });

  it("CP-10: acepta una cantidad igual a la existencia y guarda el precio al agregar", async () => {
    const cart = carritoFalso([]);
    vi.mocked(Product.findById).mockResolvedValue(dije);
    vi.mocked(Cart.findOne).mockResolvedValue(cart);
    cart.populate.mockImplementation(async () => {
      cart.items = cart.items.map((i) => ({ ...i, product: dije }));
      return cart;
    });
    const res = mockRes();
    await addToCart(mockReq({ user: usuario, body: { productId: "p2", qty: 5 } }), res);
    expect(cart.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 44500 }));
  });

  // DEF-03 (abierto): el controlador valida cada solicitud por separado, no la cantidad acumulada.
  it.fails("CP-12 / DEF-03: rechaza unidades que superan la existencia acumulada en el carrito", async () => {
    const cart = carritoFalso([item(dije, 1)]);
    vi.mocked(Product.findById).mockResolvedValue(dije);
    vi.mocked(Cart.findOne).mockResolvedValue(cart);
    const res = mockRes();
    await addToCart(mockReq({ user: usuario, body: { productId: "p2", qty: 5 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("al actualizar la cantidad también valida contra la existencia", async () => {
    const cart = carritoFalso([{ _id: "i1", product: "p2", qty: 1 }]);
    vi.mocked(Cart.findOne).mockResolvedValue(cart);
    vi.mocked(Product.findById).mockResolvedValue(dije);
    const res = mockRes();
    await updateCartItem(mockReq({ user: usuario, params: { itemId: "i1" }, body: { qty: 9 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(cart.save).not.toHaveBeenCalled();
  });
});

describe("controllers/cartController — cupones (RF-06, RF-07)", () => {
  const aplicar = async (items, datosCupon, codigo = "CUPON") => {
    vi.mocked(Cart.findOne).mockReturnValue(consulta(carritoFalso(items)));
    vi.mocked(Coupon.findOne).mockResolvedValue(datosCupon ? cupon(datosCupon) : null);
    const res = mockRes();
    await applyCoupon(mockReq({ user: usuario, body: { code: codigo } }), res);
    return res;
  };

  it("CP-13: con subtotal igual al mínimo aplica el descuento fijo (2 100 → 1 900)", async () => {
    const res = await aplicar([item(maletin, 1)], { code: "MIN2100", type: "fixed", value: 200, minOrderValue: 2100 });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 2100, discount: 200, discountedSubtotal: 1900 }));
  });

  it("CP-14: con subtotal un valor por debajo del mínimo rechaza el cupón", async () => {
    const res = await aplicar([item({ ...maletin, price: 2099 }, 1)], { code: "MIN2100", type: "fixed", value: 200, minOrderValue: 2100 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Minimum order ₹2100" });
  });

  it("CP-15: rechaza un cupón vencido", async () => {
    const res = await aplicar([item(maletin, 1)], { code: "OLD", type: "fixed", value: 100, expiresAt: "2020-01-01" });
    expect(res.json).toHaveBeenCalledWith({ message: "Coupon not in active window" });
  });

  it("CP-16: rechaza el cupón cuando el usuario ya alcanzó su límite", async () => {
    const res = await aplicar([item(maletin, 1)], { code: "UNO", type: "fixed", value: 100, perUserLimit: 1, usedBy: [{ user: "u1", count: 1 }] });
    expect(res.json).toHaveBeenCalledWith({ message: "Per-user limit reached" });
  });

  it("CP-17: el descuento porcentual no supera el tope del cupón", async () => {
    const res = await aplicar([item(dije, 1)], { code: "P20", type: "percent", value: 20, maxDiscount: 500 });
    // 20 % de 8 900 = 1 780, con tope en 500
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount: 500, discountedSubtotal: 8400 }));
  });

  it("CP-18: un cupón restringido a una categoría solo descuenta los productos de esa categoría", async () => {
    const res = await aplicar([item(maletin, 1), item(dije, 1)], { code: "JOYAS10", type: "percent", value: 10, allowedCategories: ["Jewelry"] });
    // 10 % solo sobre el dije (8 900) = 890
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 11000, discount: 890 }));
  });

  it("rechaza un código inexistente con 'Invalid code'", async () => {
    const res = await aplicar([item(maletin, 1)], null, "NOEXISTE");
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid code" });
  });

  it("getCart informa el error del cupón aplicado cuando dejó de ser válido", async () => {
    const cart = carritoFalso([item(maletin, 1)], { appliedCoupon: { code: "OFF" } });
    vi.mocked(Cart.findOne).mockReturnValue(consulta(cart));
    vi.mocked(Coupon.findOne).mockResolvedValue(cupon({ code: "OFF", active: false, type: "fixed", value: 100 }));
    const res = mockRes();
    await getCart(mockReq({ user: usuario }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount: 0, couponError: "Coupon inactive", discountedSubtotal: 2100 }));
  });
});
