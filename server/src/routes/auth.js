const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

function userDto(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    online: user.online,
    blocked: user.blocked
  };
}

function sign(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Champs obligatoires manquants." });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Cet email existe déjà." });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, avatar });
    res.status(201).json({ token: sign(user), user: userDto(user) });
  } catch (err) {
    res.status(500).json({ message: "Erreur inscription.", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, deleted: false });
    if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    if (user.blocked) return res.status(403).json({ message: "Compte bloqué." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Email ou mot de passe incorrect." });

    user.online = true;
    user.lastSeen = new Date();
    await user.save();

    res.json({ token: sign(user), user: userDto(user) });
  } catch (err) {
    res.status(500).json({ message: "Erreur connexion.", error: err.message });
  }
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user: userDto(user) });
});

module.exports = router;
