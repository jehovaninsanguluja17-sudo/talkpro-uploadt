const express = require("express");
const Group = require("../models/Group");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const groups = await Group.find({ members: req.user.id, deleted: false })
    .populate("members", "name email avatar online")
    .sort({ updatedAt: -1 });
  res.json({ groups });
});

router.post("/", auth, async (req, res) => {
  const { name, description, members = [], avatar } = req.body;
  if (!name) return res.status(400).json({ message: "Nom du groupe obligatoire." });

  const allMembers = Array.from(new Set([req.user.id, ...members]));
  const group = await Group.create({
    name,
    description,
    avatar,
    createdBy: req.user.id,
    admins: [req.user.id],
    members: allMembers
  });

  res.status(201).json({ group });
});

router.post("/:groupId/members", auth, async (req, res) => {
  const { userId } = req.body;
  const group = await Group.findOne({ _id: req.params.groupId, admins: req.user.id, deleted: false });
  if (!group) return res.status(403).json({ message: "Seul un admin du groupe peut ajouter." });

  if (!group.members.map(String).includes(userId)) group.members.push(userId);
  await group.save();
  res.json({ group });
});

module.exports = router;
