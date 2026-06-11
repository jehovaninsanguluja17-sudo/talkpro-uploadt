const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

function dto(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    bio: user.bio,
    statusText: user.statusText,
    role: user.role,
    online: user.online,
    blocked: user.blocked
  };
}

router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user: dto(user) });
});

router.patch("/", auth, async (req, res) => {
  const { name, avatar, phone, bio, statusText } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (avatar !== undefined) updates.avatar = avatar;
  if (phone !== undefined) updates.phone = phone;
  if (bio !== undefined) updates.bio = bio;
  if (statusText !== undefined) updates.statusText = statusText;

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
  res.json({ user: dto(user) });
});

router.patch("/password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: "Le nouveau mot de passe doit avoir au moins 6 caractères." });
  }

  const user = await User.findById(req.user.id);
  const ok = await bcrypt.compare(currentPassword || "", user.password);
  if (!ok) return res.status(401).json({ message: "Ancien mot de passe incorrect." });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: "Mot de passe modifié." });
});

module.exports = router;
