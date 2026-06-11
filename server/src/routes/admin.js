const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Message = require("../models/Message");
const Request = require("../models/Request");
const Group = require("../models/Group");
const Call = require("../models/Call");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.use(auth, adminOnly);

router.get("/stats", async (req, res) => {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const [users, online, blocked, messages, messagesToday, pendingRequests, groups, calls, callsToday] = await Promise.all([
    User.countDocuments({ deleted: false }),
    User.countDocuments({ online: true, deleted: false }),
    User.countDocuments({ blocked: true, deleted: false }),
    Message.countDocuments({ deleted: false }),
    Message.countDocuments({ deleted: false, createdAt: { $gte: startToday } }),
    Request.countDocuments({ status: "pending" }),
    Group.countDocuments({ deleted: false }),
    Call.countDocuments({}),
    Call.countDocuments({ createdAt: { $gte: startToday } })
  ]);

  res.json({ users, online, blocked, messages, messagesToday, pendingRequests, groups, calls, callsToday });
});

router.get("/users", async (req, res) => {
  const users = await User.find({ deleted: false }).select("-password").sort({ createdAt: -1 });
  res.json({ users });
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["admin", "moderator", "user"].includes(role)) return res.status(400).json({ message: "Rôle invalide." });

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
  res.json({ user });
});

router.patch("/users/:id/block", async (req, res) => {
  const { blocked } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { blocked: !!blocked }, { new: true }).select("-password");
  res.json({ user });
});

router.delete("/users/:id", async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { deleted: true, online: false }, { new: true }).select("-password");
  res.json({ user });
});

router.post("/announcement", async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Message obligatoire." });

  const users = await User.find({ deleted: false, blocked: false }).select("_id");
  const docs = users
    .filter(u => String(u._id) !== req.user.id)
    .map(u => ({ from: req.user.id, to: u._id, type: "announcement", content }));

  await Message.insertMany(docs);
  res.status(201).json({ sent: docs.length });
});

router.post("/reset-user-password/:id", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: "Nouveau mot de passe obligatoire." });
  const hash = await bcrypt.hash(password, 10);
  await User.findByIdAndUpdate(req.params.id, { password: hash });
  res.json({ message: "Mot de passe réinitialisé." });
});

module.exports = router;
