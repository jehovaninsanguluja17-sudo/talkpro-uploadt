const express = require("express");
const Call = require("../models/Call");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const calls = await Call.find({
    $or: [{ from: req.user.id }, { to: req.user.id }]
  })
    .populate("from", "name email avatar")
    .populate("to", "name email avatar")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ calls });
});

module.exports = router;
