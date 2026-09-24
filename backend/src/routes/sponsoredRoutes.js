import express from "express";
import SponsoredPlacement from "../models/SponsoredPlacement.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";

const router = express.Router();

const clientIp = (req) =>
  (Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"] || req.ip || ""
  )
    .toString()
    .split(",")[0]
    .trim() || "unknown";

const sessionOf = (req) => {
  const ua = (req.get("user-agent") || "").slice(0, 128);
  return (
    req.cookies?.sid || req.cookies?.rt || `${clientIp(req)}|${ua.slice(0, 32)}`
  );
};

const ymdUTC = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

router.post("/:id/impression", async (req, res) => {
  try {
    const { id } = req.params;
    const sid = sessionOf(req);
    const ymd = ymdUTC();

    const exists = await AnalyticsEvent.findOne({
      sessionId: sid,
      event: "sponsored_impression",
      ymd,
      "meta.placementId": String(id),
    }).lean();

    if (!exists) {
      await SponsoredPlacement.updateOne(
        { _id: id },
        { $inc: { impressions: 1 } }
      );
      try {
        await AnalyticsEvent.create({
          sessionId: sid,
          userId: req.user?._id,
          event: "sponsored_impression",
          meta: { placementId: String(id) },
          ip: clientIp(req),
          ua: req.get("user-agent"),
          createdAt: new Date(),
        });
      } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/click", async (req, res) => {
  try {
    const { id } = req.params;
    const sid = sessionOf(req);
    const ymd = ymdUTC();

    const exists = await AnalyticsEvent.findOne({
      sessionId: sid,
      event: "sponsored_click",
      ymd,
      "meta.placementId": String(id),
    }).lean();

    if (!exists) {
      await SponsoredPlacement.updateOne({ _id: id }, { $inc: { clicks: 1 } });
      try {
        await AnalyticsEvent.create({
          sessionId: sid,
          userId: req.user?._id,
          event: "sponsored_click",
          meta: { placementId: String(id) },
          ip: clientIp(req),
          ua: req.get("user-agent"),
          createdAt: new Date(),
        });
      } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

