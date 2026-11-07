import express from "express";
import SponsoredPlacement from "../models/SponsoredPlacement.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import { clientIp, sessionOf, ymdUTC } from "../utils/session.js";

const router = express.Router();

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

