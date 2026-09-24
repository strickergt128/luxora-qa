export default function resetPasswordEmail(user, token) {
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetUrl = `${frontend}/auth/reset-password?token=${token}`;
  const year = new Date().getFullYear();
  const name = user?.name || "there";
  return `
  <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
.container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.hero { text-align: center; padding: 45px 25px; color: #ffffff; }
.content { padding: 30px 25px; color: #374151; line-height: 1.6; text-align: center; }
.content h2 { margin: 0 0 15px; color: #111827; }
.btn { display: inline-block; margin-top: 25px; padding: 14px 32px; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; transition: background 0.2s ease-in-out; text-align: center; }
.footer { background: #f9fafb; text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
.note { font-size: 12px; color: #6b7280; margin-top: 20px; }
</style>
</head>
<body>
<div class="container">
  <div class="hero" style="background: linear-gradient(135deg, #075985, #0f766e);">
    <h1>Password Reset Requested</h1>
    <p>Secure your account quickly</p>
  </div>
  <div class="content">
    <h2>Hello ${name},</h2>
    <p>We received a request to reset your password for <strong>Luxora</strong>. If this was you, click the button below to set a new password. This link will expire soon for security reasons.</p>
    <a class="btn" href="${resetUrl}" style="background:#0369a1;">Reset Password</a>
    <p class="note">If you did not request this, you can safely ignore this email. For your security, the link will expire shortly.</p>
  </div>
  <div class="footer">© ${year} Luxora Marketplace. All rights reserved.</div>
</div>
</body>
</html>
  `;
}
