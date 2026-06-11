const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  bio: { type: String, default: "" },
  statusText: { type: String, default: "Disponible" },
  theme: { type: String, enum: ["light", "dark"], default: "light" }
}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);
