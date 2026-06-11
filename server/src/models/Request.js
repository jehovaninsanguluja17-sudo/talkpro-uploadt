const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
}, { timestamps: true });

requestSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model("Request", requestSchema);
