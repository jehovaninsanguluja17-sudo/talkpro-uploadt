const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  type: { type: String, enum: ["text", "image", "audio", "file", "announcement"], default: "text" },
  content: { type: String, required: true },
  fileName: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deliveredAt: { type: Date },
  readAt: { type: Date },
  deleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
