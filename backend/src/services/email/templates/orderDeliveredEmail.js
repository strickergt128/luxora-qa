export default function orderDeliveredEmail(user, order) {
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const year = new Date().getFullYear();
  const name = user?.name || "there";
  const itemsHtml = (order?.items || [])
    .map((item) => `<li>${item.product.title} (x${item.qty}) - ₹${item.price}</li>`)
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; }
      .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; padding: 20px; }
      .header { background: linear-gradient(135deg,#0369a1,#0f766e); color: #fff; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { margin: 20px 0; }
      .btn { display: inline-block; padding: 12px 20px; background: #0369a1; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
      .items { margin: 15px 0; padding: 0; }
      .items li { margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Order Delivered</div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>Your order <strong>#${
          order._id
        }</strong> has been delivered successfully.</p>
        <ul class="items">${itemsHtml}</ul>
        <p><strong>Total Paid: ₹${order.totalAmount}</strong></p>
        <p>We’d love your feedback. Please leave a review for your purchased items.</p>
        <a class="btn" href="${frontend}/orders/${
    order._id
  }">Leave a Review</a>
      </div>
      <div class="footer">© ${year} Luxora Marketplace. All rights reserved.</div>
    </div>
  </body>
  </html>
  `;
}
