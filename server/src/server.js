require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Request = require("./models/Request");
const Message = require("./models/Message");
const Group = require("./models/Group");
const Call = require("./models/Call");
const seedAdmin = require("./seedAdmin");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const requestRoutes = require("./routes/requests");
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const adminRoutes = require("./routes/admin");
const uploadRoutes = require("./routes/upload");
const profileRoutes = require("./routes/profile");
const mediaRoutes = require("./routes/media");
const callRoutes = require("./routes/calls");

const app = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json({ limit: "15mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/calls", callRoutes);

app.use(express.static(path.join(__dirname, "..", "..", "client")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "client", "index.html"));
});

const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "*", credentials: true } });

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.deleted || user.blocked) throw new Error("Compte invalide.");
    socket.user = { id: String(user._id), role: user.role, name: user.name };
    next();
  } catch {
    next(new Error("Non autorisé"));
  }
});

async function areFriends(a, b) {
  return Request.exists({ status: "accepted", $or: [{ from: a, to: b }, { from: b, to: a }] });
}

io.on("connection", async (socket) => {
  const userId = socket.user.id;
  socket.join(userId);

  await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
  io.emit("presence:update", { userId, online: true });

  const groups = await Group.find({ members: userId, deleted: false }).select("_id");
  groups.forEach(g => socket.join("group:" + g._id));

  socket.on("message:private", async (payload, cb) => {
    try {
      const { to, type = "text", content, fileName = "", mimeType = "", size = 0 } = payload;
      const ok = await areFriends(userId, to);
      if (!ok) throw new Error("Vous devez être contacts pour discuter.");

      const recipient = await User.findById(to).select("online");
      const message = await Message.create({
        from: userId,
        to,
        type,
        content,
        fileName,
        mimeType,
        size,
        deliveredAt: recipient && recipient.online ? new Date() : undefined
      });

      io.to(userId).emit("message:new", message);
      io.to(to).emit("message:new", message);
      io.to(userId).emit("message:status", {
        messageId: message._id,
        to,
        deliveredAt: message.deliveredAt,
        readAt: message.readAt
      });
      cb && cb({ ok: true, message });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });

  socket.on("message:group", async (payload, cb) => {
    try {
      const { groupId, type = "text", content, fileName = "", mimeType = "", size = 0 } = payload;
      const group = await Group.findOne({ _id: groupId, members: userId, deleted: false });
      if (!group) throw new Error("Groupe non autorisé.");

      const message = await Message.create({ from: userId, group: groupId, type, content, fileName, mimeType, size, deliveredAt: new Date() });
      const populated = await Message.findById(message._id).populate("from", "name avatar");
      io.to("group:" + groupId).emit("message:group:new", populated);
      cb && cb({ ok: true, message: populated });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });


  socket.on("message:read", async ({ from }) => {
    if (!from) return;

    await Message.updateMany(
      { from, to: userId, deleted: false, readAt: { $exists: false } },
      { $set: { readAt: new Date() }, $addToSet: { readBy: userId } }
    );

    io.to(from).emit("message:read:update", { by: userId });
  });

  socket.on("typing:start", ({ to, groupId }) => {
    if (to) io.to(to).emit("typing:start", { from: userId, name: socket.user.name });
    if (groupId) socket.to("group:" + groupId).emit("typing:start", { from: userId, name: socket.user.name, groupId });
  });

  socket.on("typing:stop", ({ to, groupId }) => {
    if (to) io.to(to).emit("typing:stop", { from: userId, groupId });
    if (groupId) socket.to("group:" + groupId).emit("typing:stop", { from: userId, groupId });
  });

  socket.on("call:start", async ({ to, mode }, cb) => {
    try {
      const ok = await areFriends(userId, to);
      if (!ok) throw new Error("Vous devez être contacts pour appeler.");

      const call = await Call.create({ from: userId, to, mode: mode === "video" ? "video" : "audio" });

      io.to(to).emit("call:incoming", {
        callId: String(call._id),
        from: userId,
        mode: call.mode,
        name: socket.user.name
      });

      cb && cb({ ok: true, callId: String(call._id) });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });

  socket.on("call:accept", async ({ callId, to }) => {
    await Call.findByIdAndUpdate(callId, { status: "accepted", acceptedAt: new Date() });
    io.to(to).emit("call:accepted", { callId, from: userId });
  });

  socket.on("call:reject", async ({ callId, to }) => {
    await Call.findByIdAndUpdate(callId, { status: "rejected", endedAt: new Date() });
    io.to(to).emit("call:rejected", { callId, from: userId });
  });

  socket.on("call:end", async ({ callId, to, durationSeconds = 0 }) => {
    await Call.findByIdAndUpdate(callId, { status: "ended", endedAt: new Date(), durationSeconds });
    io.to(to).emit("call:ended", { callId, from: userId });
  });

  socket.on("webrtc:offer", ({ to, callId, offer }) => {
    io.to(to).emit("webrtc:offer", { from: userId, callId, offer });
  });

  socket.on("webrtc:answer", ({ to, callId, answer }) => {
    io.to(to).emit("webrtc:answer", { from: userId, callId, answer });
  });

  socket.on("webrtc:ice", ({ to, callId, candidate }) => {
    io.to(to).emit("webrtc:ice", { from: userId, callId, candidate });
  });

  socket.on("disconnect", async () => {
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, { online: false, lastSeen });
    io.emit("presence:update", { userId, online: false, lastSeen });
  });
});

async function start() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI manquant.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  await seedAdmin();

  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`TalkPro Connect V2 lancé sur le port ${port}`));
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
