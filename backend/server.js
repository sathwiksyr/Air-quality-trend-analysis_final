const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
require("dotenv").config();

const User = require("./models/models/User");

const app = express();

/* ================= GLOBAL MIDDLEWARE ================= */

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "supersecretkey",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

/* ================= CONNECT MONGODB ================= */

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

/* ================= PASSPORT CONFIG ================= */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

/* ================= GOOGLE STRATEGY ================= */

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.BACKEND_URL + "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        profilePic: profile.photos[0].value,
        provider: "google"
      });
    }

    return done(null, user);

  } catch (error) {
    console.log("Google Auth Error:", error);
    done(error, null);
  }
}));

/* ================= AUTH MIDDLEWARE ================= */

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.id;
    next();

  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/* ================= LOCAL SIGNUP ================= */

app.post("/api/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashedPassword,
      provider: "local"
    });

    res.json({ message: "Signup successful" });

  } catch (error) {
    res.status(500).json({ message: "Signup failed" });
  }
});

/* ================= LOCAL LOGIN ================= */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });

  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

/* ================= GOOGLE ROUTES ================= */

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {

    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.redirect(`http://localhost:3000/oauth-success?token=${token}`);
  }
);

/* ================= GET CURRENT USER ================= */

app.get("/api/user", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json(user);
});

/* ================= UPDATE PROFILE ================= */

app.put("/api/user/update", verifyToken, async (req, res) => {
  try {
    const { name, profilePic } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, profilePic },
      { new: true }
    ).select("-password");

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

/* ================= CHANGE PASSWORD ================= */

app.put("/api/user/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Wrong current password" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: "Password updated successfully" });

  } catch (error) {
    res.status(500).json({ message: "Password update failed" });
  }
});

/* ================= PROTECTED AIRDATA ROUTE ================= */

app.get("/api/airdata", verifyToken, async (req, res) => {
  try {
    const data = await mongoose.connection.db
      .collection("airdata")
      .find()
      .limit(20)
      .toArray();

    res.json(data);

  } catch (error) {
    res.status(500).json({ message: "Data fetch failed" });
  }
});

/* ================= START SERVER ================= */
app.listen(5000, '0.0.0.0', () => {
  console.log("Server running");
});