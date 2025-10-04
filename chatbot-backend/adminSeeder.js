const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./models/adminModel");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("✅ MongoDB Connected");

  // check if already admin exists
  const existingAdmin = await Admin.findOne({ username: "admin1" });
  if (existingAdmin) {
    console.log("⚠️ Admin already exists");
    process.exit();
  }

  const hashedPassword = await bcrypt.hash("123456", 10);

  await Admin.create({
    username: "admin1",
    password: hashedPassword
  });

  console.log("✅ Admin created: username=admin1, password=123456");
  process.exit();
});
