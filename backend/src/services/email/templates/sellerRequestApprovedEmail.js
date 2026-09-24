const sellerRequestApprovedEmail = (user) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f9f9f9;padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" 
           style="max-width:600px;margin:0 auto;background:#ffffff;
                  border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
      <tr>
        <td style="background:linear-gradient(135deg,#0369a1,#0f766e);padding:20px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:24px;">🎉 Welcome, ${user.name}!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:30px;">
          <p style="font-size:16px;color:#333;line-height:1.6;">
            Great news! Your request to become a <b>Seller</b> on <b>Luxora Marketplace</b> has been 
            <span style="color:#0369a1;font-weight:bold;">approved</span>.
          </p>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            You can now start listing products, managing inventory, and tracking orders directly from your dashboard.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/seller"
              style="background:#0369a1;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
              Go to Seller Dashboard
            </a>
          </div>
          <p style="font-size:14px;color:#555;">We’re excited to see your shop grow 🚀</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777;">
          &copy; ${new Date().getFullYear()} Luxora Marketplace — All rights reserved
        </td>
      </tr>
    </table>
  </div>`;

export default sellerRequestApprovedEmail;
