import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

/*
 * DOBLES DE PRUEBA — cliente HTTP (utils/api) y analítica.
 * Por qué se aíslan: los thunks del carrito llaman al backend. Con el cliente simulado
 * se prueba solo cómo el slice actualiza el estado con cada respuesta, sin red ni servidor.
 * La analítica se reemplaza para verificar que se registra el evento sin enviarlo.
 */
vi.mock("../../src/utils/api", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("../../src/utils/analytics", () => ({ trackAddToCart: vi.fn() }));

import api from "../../src/utils/api";
import { trackAddToCart } from "../../src/utils/analytics";
import reducer, {
  increaseQty, decreaseQty, clearCart, fetchCart, addToCart, applyCoupon, removeCoupon, updateCartQty,
} from "../../src/store/slices/cartSlice";

const crearStore = () => configureStore({ reducer: { cart: reducer } });
const item = (id: string, qty: number) => ({ _id: id, product: { _id: "p" + id, title: "Producto", price: 100 }, qty });

beforeEach(() => vi.clearAllMocks());

describe("store/slices/cartSlice — reducers", () => {
  it("parte de un carrito vacío sin cupón", () => {
    const estado = reducer(undefined, { type: "@@init" });
    expect(estado).toMatchObject({ items: [], subtotal: 0, discount: 0, appliedCoupon: null, loading: false });
  });

  it("increaseQty suma una unidad y decreaseQty nunca baja de 1", () => {
    let estado = reducer(undefined, { type: "@@init" });
    estado = { ...estado, items: [item("1", 1)] };
    estado = reducer(estado, increaseQty("1"));
    expect(estado.items[0].qty).toBe(2);
    estado = reducer(estado, decreaseQty("1"));
    estado = reducer(estado, decreaseQty("1"));
    expect(estado.items[0].qty).toBe(1);
  });

  it("clearCart vacía los productos, los montos y el cupón", () => {
    const lleno = { ...reducer(undefined, { type: "@@init" }), items: [item("1", 2)], subtotal: 200, discount: 20, appliedCoupon: { code: "X", type: "fixed" as const, value: 20 } };
    expect(reducer(lleno, clearCart())).toMatchObject({ items: [], subtotal: 0, discount: 0, discountedSubtotal: 0, appliedCoupon: null });
  });
});

describe("store/slices/cartSlice — thunks con el cliente HTTP simulado", () => {
  it("fetchCart calcula el subtotal con descuento cuando la respuesta no lo trae", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [item("1", 2)], subtotal: 2100, discount: 200 } });
    const store = crearStore();
    await store.dispatch(fetchCart());
    expect(api.get).toHaveBeenCalledWith("/cart");
    expect(store.getState().cart).toMatchObject({ subtotal: 2100, discount: 200, discountedSubtotal: 1900, loading: false });
  });

  it("fetchCart guarda el mensaje de error cuando el servidor falla", async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { data: { message: "Internal server error" } } });
    const store = crearStore();
    await store.dispatch(fetchCart());
    expect(store.getState().cart.error).toBe("Internal server error");
  });

  it("addToCart actualiza los productos y registra el evento de analítica", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [item("1", 1)], subtotal: 8900 } });
    const store = crearStore();
    await store.dispatch(addToCart({ productId: "p1", qty: 1 }));
    expect(api.post).toHaveBeenCalledWith("/cart", { productId: "p1", qty: 1 });
    expect(trackAddToCart).toHaveBeenCalledWith("p1");
    expect(store.getState().cart).toMatchObject({ subtotal: 8900, discountedSubtotal: 8900 });
  });

  it("addToCart no cambia el carrito si el servidor responde 'Not enough stock'", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: "Not enough stock" } } });
    const store = crearStore();
    const accion = await store.dispatch(addToCart({ productId: "p2", qty: 6 }));
    expect(accion.type).toBe("cart/add/rejected");
    expect(store.getState().cart.items).toEqual([]);
    expect(trackAddToCart).not.toHaveBeenCalled();
  });

  it("applyCoupon guarda el cupón y el descuento; si falla, guarda el motivo", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { items: [], appliedCoupon: { code: "MIN2100", type: "fixed", value: 200 }, subtotal: 2100, discount: 200, discountedSubtotal: 1900 },
    });
    const store = crearStore();
    await store.dispatch(applyCoupon("MIN2100"));
    expect(store.getState().cart).toMatchObject({ discount: 200, discountedSubtotal: 1900, couponError: null });

    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Minimum order ₹2100" } } });
    await store.dispatch(applyCoupon("MIN2100"));
    expect(store.getState().cart.couponError).toBe("Minimum order ₹2100");
  });

  it("removeCoupon deja el descuento en 0 y el subtotal sin descuento", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [], subtotal: 2100, discountedSubtotal: 2100 } });
    const store = crearStore();
    await store.dispatch(removeCoupon());
    expect(store.getState().cart).toMatchObject({ discount: 0, discountedSubtotal: 2100, appliedCoupon: null });
  });

  it("updateCartQty envía la nueva cantidad al item correcto", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { items: [item("1", 3)], subtotal: 300 } });
    const store = crearStore();
    await store.dispatch(updateCartQty({ itemId: "i1", qty: 3 }));
    expect(api.put).toHaveBeenCalledWith("/cart/i1", { qty: 3 });
    expect(store.getState().cart.subtotal).toBe(300);
  });
});
