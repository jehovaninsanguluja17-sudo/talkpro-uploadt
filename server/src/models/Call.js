const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  mode: { type: String, enum: ["audio", "video"], required: true },
  status: { type: String, enum: ["ringing", "accepted", "rejected", "ended", "missed"], default: "ringing" },
  startedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  endedAt: { type: Date },
  durationSeconds: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Call", callSchema);
