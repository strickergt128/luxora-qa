import EmailTemplate from "../models/EmailTemplate.js";
import welcomeEmail from "../services/email/templates/welcomeEmail.js";
import resetPasswordEmail from "../services/email/templates/resetPasswordEmail.js";
import orderConfirmationEmail from "../services/email/templates/orderConfirmationEmail.js";
import orderDeliveredEmail from "../services/email/templates/orderDeliveredEmail.js";
import sellerRequestApprovedEmail from "../services/email/templates/sellerRequestApprovedEmail.js";
import sellerRequestRejectedEmail from "../services/email/templates/sellerRequestRejectedEmail.js";
import priceDropEmail from "../services/email/templates/priceDropEmail.js";
import { logAdminAction } from "../utils/adminLog.js";

const DEFAULTS = {
  welcome: {
    subject: "Welcome to Luxora Marketplace",
    html: (data) => welcomeEmail(data.user),
  },
  resetPassword: {
    subject: "Reset Your Password",
    html: (data) => resetPasswordEmail(data.user, data.token || "SAMPLE_TOKEN"),
  },
  orderConfirmation: {
    subject: "Order Confirmation ✔️",
    html: (data) => orderConfirmationEmail(data.user, data.order),
  },
  orderDelivered: {
    subject: "Order Delivered 🎉",
    html: (data) => orderDeliveredEmail(data.user, data.order),
  },
  sellerApproved: {
    subject: "Your Seller Request Has Been Approved 🎉",
    html: (data) => sellerRequestApprovedEmail(data.user),
  },
  sellerRejected: {
    subject: "Your Seller Request Has Been Rejected ❌",
    html: (data) => sellerRequestRejectedEmail(data.user),
  },
  // NEW: price drop
  priceDrop: {
    subject: "Price drop: {{product.title}} now at ₹{{newPrice}}",
    html: (data) =>
      priceDropEmail(
        data.user,
        data.product,
        Number(data.oldPrice || 1999),
        Number(data.newPrice || 1499)
      ),
  },
};

// simple token replace for overrides
function renderTokens(html, subject, data) {
  const itemsHtml =
    data.order?.items
      ?.map(
        (it) =>
          `<li>${it.product?.title || "Item"} (x${it.qty}) - ₹${it.price}</li>`
      )
      .join("") || "";

  const map = {
    "{{frontendUrl}}": `${process.env.FRONTEND_URL || "http://localhost:3000"}`,
    // user
    "{{user.name}}": data.user?.name || "User",
    "{{user.email}}": data.user?.email || "user@example.com",
    // order tokens
    "{{order._id}}": data.order?._id || "ORDER_ID",
    "{{order.totalAmount}}": data.order?.totalAmount || "0",
    "{{order.itemsHtml}}": itemsHtml,
    "{{frontend.orderUrl}}": `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/orders/${data.order?._id || "ORDER_ID"}`,
    "{{token}}": data.token || "TOKEN",
    // NEW product/price tokens (for priceDrop)
    "{{product.title}}": data?.product?.title || "Product",
    "{{oldPrice}}": data?.oldPrice != null ? data.oldPrice : "0",
    "{{newPrice}}": data?.newPrice != null ? data.newPrice : "0",
    "{{frontend.productUrl}}": `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/products/${data?.product?._id || data?.product?.slug || ""}`,
  };

  let outHtml = html;
  let outSubject = subject;
  for (const [k, v] of Object.entries(map)) {
    outHtml = outHtml.replaceAll(k, String(v));
    outSubject = outSubject.replaceAll(k, String(v));
  }
  return { html: outHtml, subject: outSubject };
}

function sampleData() {
  return {
    user: { name: "Alex Doe", email: "alex@example.com" },
    token: "SAMPLE_TOKEN",
    order: {
      _id: "65e9ab12cd34ef5678abcd12",
      totalAmount: 1999,
      items: [
        { qty: 1, price: 999, product: { title: "Wireless Headphones" } },
        { qty: 2, price: 500, product: { title: "USB-C Cable" } },
      ],
    },
    // NEW: used by priceDrop defaults/preview
    product: {
      _id: "65e9ab12cd34ef5678abcd12",
      title: "ASUS TUF Gaming F15",
      slug: "asus-tuf-gaming-f15-2025",
    },
    oldPrice: 79999,
    newPrice: 74999,
  };
}

export const listTemplates = async (_req, res) => {
  const overrides = await EmailTemplate.find({}, "key updatedAt").lean();
  const keys = Object.keys(DEFAULTS);
  res.json(
    keys.map((k) => ({
      key: k,
      hasOverride: overrides.some((o) => o.key === k),
    }))
  );
};

export const getTemplate = async (req, res) => {
  const key = req.params.key;
  if (!DEFAULTS[key])
    return res.status(404).json({ message: "Unknown template key" });
  const override = await EmailTemplate.findOne({ key }).lean();
  const samples = sampleData();
  const defSubject = DEFAULTS[key].subject;
  const defHtml = DEFAULTS[key].html(samples);
  res.json({
    key,
    default: { subject: defSubject, html: defHtml },
    override: override
      ? { subject: override.subject, html: override.html }
      : null,
    samples,
  });
};

export const saveTemplate = async (req, res) => {
  const key = req.params.key;
  const { subject, html } = req.body;
  if (!DEFAULTS[key])
    return res.status(404).json({ message: "Unknown template key" });
  if (!subject || !html)
    return res.status(400).json({ message: "subject and html required" });

  const prev = await EmailTemplate.findOne({ key }).lean();
  const up = await EmailTemplate.findOneAndUpdate(
    { key },
    { subject, html, updatedBy: req.user._id },
    { upsert: true, new: true }
  );

  await logAdminAction(req, {
    action: "emailTemplate.save",
    entityType: "emailTemplate",
    entityId: key,
    summary: `Saved email template "${key}"`,
    before: prev
      ? { subjectLen: prev.subject?.length || 0, hadOverride: true }
      : { hadOverride: false },
    after: { subjectLen: subject.length },
    note: undefined,
  });

  res.json({ message: "Saved", template: up });
};

export const renderPreview = async (req, res) => {
  const key = req.body.key;
  const { subject, html, data } = req.body;
  if (!DEFAULTS[key])
    return res.status(404).json({ message: "Unknown template key" });

  const samples = data || sampleData();

  let outSubject = subject;
  let outHtml = html;

  if (!subject || !html) {
    // render default if not provided
    outSubject = DEFAULTS[key].subject;
    outHtml = DEFAULTS[key].html(samples);
  } else {
    ({ subject: outSubject, html: outHtml } = renderTokens(
      html,
      subject,
      samples
    ));
  }

  res.json({ subject: outSubject, html: outHtml, data: samples });
};
