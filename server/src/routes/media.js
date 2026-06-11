const express = require("express");
const Message = require("../models/Message");
const Request = require("../models/Request");
const Group = require("../models/Group");
const { auth } = require("../middleware/auth");

const router = express.Router();

async function areFriends(a, b) {
  return Request.exists({ status: "accepted", $or: [{ from: a, to: b }, { from: b, to: a }] });
}

router.get("/private/:userId", auth, async (req, res) => {
  const ok = await areFriends(req.user.id, req.params.userId);
  if (!ok) return res.status(403).json({ message: "Non autorisé." });

  const media = await Message.find({
    deleted: false,
    type: { $in: ["image", "audio", "file"] },
    $or: [
      { from: req.user.id, to: req.params.userId },
      { from: req.params.userId, to: req.user.id }
    ]
  }).sort({ createdAt: -1 }).limit(100);

  res.json({ media });
});

router.get("/group/:groupId", auth, async (req, res) => {
  const group = await Group.findOne({ _id: req.params.groupId, members: req.user.id, deleted: false });
  if (!group) return res.status(403).json({ message: "Non autorisé." });

  const media = await Message.find({
    group: group._id,
    deleted: false,
    type: { $in: ["image", "audio", "file"] }
  }).populate("from", "name avatar").sort({ createdAt: -1 }).limit(100);

  res.json({ media });
});

module.exports = router;
