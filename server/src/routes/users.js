const express = require("express");
const User = require("../models/User");
const Request = require("../models/Request");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.id }, deleted: false })
    .select("-password").sort({ online: -1, name: 1 });

  const requests = await Request.find({ $or: [{ from: req.user.id }, { to: req.user.id }] });

  const data = users.map(u => {
    const r = requests.find(x =>
      (String(x.from) === req.user.id && String(x.to) === String(u._id)) ||
      (String(x.to) === req.user.id && String(x.from) === String(u._id))
    );

    let relation = "none";
    if (r) {
      if (r.status === "accepted") relation = "friend";
      else if (r.status === "pending" && String(r.from) === req.user.id) relation = "sent";
      else if (r.status === "pending" && String(r.to) === req.user.id) relation = "received";
      else relation = r.status;
    }

    return {
      id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      online: u.online,
      blocked: u.blocked,
      lastSeen: u.lastSeen,
      relation
    };
  });

  res.json({ users: data });
});

module.exports = router;
