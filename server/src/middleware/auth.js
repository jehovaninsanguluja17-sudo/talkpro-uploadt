const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Accès refusé." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user || user.deleted) return res.status(401).json({ message: "Compte introuvable." });
    if (user.blocked) return res.status(403).json({ message: "Compte bloqué par l’administrateur." });

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name
    };
    next();
  } catch {
    res.status(401).json({ message: "Session invalide." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Réservé à l’administrateur." });
  }
  next();
}

module.exports = { auth, adminOnly };
