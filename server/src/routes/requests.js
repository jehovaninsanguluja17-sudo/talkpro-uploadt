const express = require("express");
const Request = require("../models/Request");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.post("/:toId", auth, async (req, res) => {
  try {
    if (req.params.toId === req.user.id) return res.status(400).json({ message: "Action impossible." });

    const exists = await Request.findOne({
      $or: [
        { from: req.user.id, to: req.params.toId },
        { from: req.params.toId, to: req.user.id }
      ]
    });
    if (exists) return res.status(409).json({ message: "Demande déjà existante." });

    const request = await Request.create({ from: req.user.id, to: req.params.toId });
    res.status(201).json({ request });
  } catch (err) {
    res.status(500).json({ message: "Erreur demande.", error: err.message });
  }
});

router.get("/incoming", auth, async (req, res) => {
  const requests = await Request.find({ to: req.user.id, status: "pending" })
    .populate("from", "name email avatar online role")
    .sort({ createdAt: -1 });
  res.json({ requests });
});

router.post("/:fromId/accept", auth, async (req, res) => {
  const request = await Request.findOneAndUpdate(
    { from: req.params.fromId, to: req.user.id, status: "pending" },
    { status: "accepted" },
    { new: true }
  );
  if (!request) return res.status(404).json({ message: "Demande introuvable." });
  res.json({ request });
});

router.post("/:fromId/reject", auth, async (req, res) => {
  const request = await Request.findOneAndUpdate(
    { from: req.params.fromId, to: req.user.id, status: "pending" },
    { status: "rejected" },
    { new: true }
  );
  if (!request) return res.status(404).json({ message: "Demande introuvable." });
  res.json({ request });
});

module.exports = router;
