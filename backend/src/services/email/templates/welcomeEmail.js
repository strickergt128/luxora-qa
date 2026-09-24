export default function welcomeEmail(user) {
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const year = new Date().getFullYear();
  const name = user?.name || "there";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Luxora</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background: #f3f4f6;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      .hero {
        background: linear-gradient(135deg, #075985, #0f766e);
        color: #ffffff;
        text-align: center;
        padding: 45px 25px;
      }
      .hero h1 {
        margin: 0;
        font-size: 30px;
        font-weight: bold;
      }
      .hero p {
        margin-top: 12px;
        font-size: 16px;
        color: #dbeafe;
      }
      .content {
        padding: 30px 25px;
        color: #374151;
        line-height: 1.6;
        text-align: center;
      }
      .content h2 {
        margin: 0 0 15px;
        color: #111827;
      }
      .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 25px 0;
      }
      .btn {
        display: inline-block;
        margin-top: 20px;
        padding: 14px 32px;
        background: #0369a1;
        color: #ffffff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 15px;
        transition: background 0.2s ease-in-out;
      }
      .btn:hover {
        background: #075985;
      }
      .features {
        display: flex;
        justify-content: space-around;
        margin-top: 25px;
        text-align: center;
      }
      .feature {
        width: 30%;
        font-size: 14px;
        color: #4b5563;
      }
      .feature-icon {
        font-size: 26px;
        margin-bottom: 6px;
      }
      .footer {
        background: #f9fafb;
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="hero">
        <h1>Welcome to Luxora</h1>
        <p>Trusted marketplace for buyers and sellers</p>
      </div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>We’re glad you joined <strong>Luxora</strong>. Browse verified products, track orders in real time, and shop with confidence.</p>
        <a class="btn" href="${frontend}/products">Start Shopping</a>

        <div class="divider"></div>

        <div class="features">
          <div class="feature">
            <div class="feature-icon">🛍️</div>
            <p>Curated products</p>
          </div>
          <div class="feature">
            <div class="feature-icon">💵</div>
            <p>Pay on delivery</p>
          </div>
          <div class="feature">
            <div class="feature-icon">🚚</div>
            <p>Fast doorstep service</p>
          </div>
        </div>
      </div>
      <div class="footer">
        © ${year} Luxora Marketplace. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}
