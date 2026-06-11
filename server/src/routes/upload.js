const express = require("express");
const multer = require("multer");
const { auth } = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-"));
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier." });
  res.json({ url: `/uploads/${req.file.filename}`, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
});

module.exports = router;
