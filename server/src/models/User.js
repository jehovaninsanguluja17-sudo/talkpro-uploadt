const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  phone: { type: String, default: "" },
  bio: { type: String, default: "" },
  statusText: { type: String, default: "Disponible" },
  role: { type: String, enum: ["admin", "moderator", "user"], default: "user" },
  blocked: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
