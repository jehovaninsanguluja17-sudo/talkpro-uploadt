const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@talkpro.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@2026";
  const name = process.env.ADMIN_NAME || "Jehovani Nsanguluja";

  const exists = await User.findOne({ email });
  if (exists) return;

  const hash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    password: hash,
    role: "admin",
    avatar: "https://ui-avatars.com/api/?name=Jehovani+Nsanguluja&background=00a884&color=fff"
  });

  console.log("Compte administrateur créé :", email);
}

module.exports = seedAdmin;
