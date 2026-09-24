const sellerRequestRejectedEmail = (user) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f9f9f9;padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" 
           style="max-width:600px;margin:0 auto;background:#ffffff;
                  border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
      <tr>
        <td style="background:#b91c1c;padding:20px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:24px;">⚠️ Hello, ${user.name}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:30px;">
          <p style="font-size:16px;color:#333;line-height:1.6;">
            We’ve reviewed your request to become a <b>Seller</b> on <b>Luxora Marketplace</b>.
            Unfortunately, your application has been 
            <span style="color:#b91c1c;font-weight:bold;">rejected</span> at this time.
          </p>
          <p style="font-size:16px;color:#333;line-height:1.6;">
            If you believe this was a mistake, you can update your account details and reapply.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/contact"
              style="background:#b91c1c;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
              Contact Support
            </a>
          </div>
          <p style="font-size:14px;color:#555;">We still value you as our customer 💙</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777;">
          &copy; ${new Date().getFullYear()} Luxora Marketplace — All rights reserved
        </td>
      </tr>
    </table>
  </div>`;

export default sellerRequestRejectedEmail;
