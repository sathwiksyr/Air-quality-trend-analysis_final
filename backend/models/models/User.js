const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  password: String,
  googleId: String,
  linkedinId: String,
  name: String,
  profilePic: String,
  provider: {
    type: String,
    enum: ["local", "google", "linkedin"],
    default: "local"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);