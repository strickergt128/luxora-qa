export default function priceDropEmail(user, product, oldPrice, newPrice) {
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const year = new Date().getFullYear();
  const link = `${frontend}/products/${product._id || product.slug || ""}`;
  return `
  <div style="font-family: Inter, Segoe UI, Arial, sans-serif; background:#f8fafc; padding:20px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0369a1,#0f766e);color:#fff;padding:16px 20px;font-weight:700;font-size:18px;">
        Price Drop Alert
      </div>
      <div style="padding:20px;color:#1f2937;line-height:1.6;">
        <h2 style="margin:0 0 10px;">${product.title}</h2>
        <p style="margin:0 0 12px;">Good news ${user.name || ""}, the price just dropped.</p>
        <p style="margin:0 0 14px;">
          <strong>Old:</strong> ₹${oldPrice.toLocaleString("en-IN")}<br/>
          <strong>Now:</strong> <span style="color:#0369a1;font-weight:700;">₹${newPrice.toLocaleString(
            "en-IN"
          )}</span>
        </p>
        <a href="${link}" style="display:inline-block;padding:10px 16px;background:#0369a1;color:#fff;border-radius:8px;text-decoration:none;">View Product</a>
        <p style="font-size:12px;color:#64748b;margin-top:16px;">You are receiving this because you enabled price-drop alerts.</p>
      </div>
      <div style="background:#f8fafc;color:#6b7280;font-size:12px;text-align:center;padding:12px;">© ${year} Luxora Marketplace. All rights reserved.</div>
    </div>
  </div>
  `;
}
