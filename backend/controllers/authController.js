const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const register = async (req, res, next) => {
  try {
    const { full_name, email, password, role, phone } = req.body;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) 
      return res.status(409).json({ success: false, message: "Email already registered" });

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      "INSERT INTO users (full_name, email, password_hash, role, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id, full_name, email, role",
      [full_name, email, password_hash, role, phone || null]
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: role === "doctor" ? "Registered! Await admin approval." : "Registered successfully.",
      token,
      user
    });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT id, full_name, email, role, password_hash, is_active FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, "$2a$12$dummyhashtopreventtimingattacks000000000");

    if (!user || !passwordMatch)
      return res.status(401).json({ success: false, message: "Invalid email or password" });

    if (!user.is_active)
      return res.status(403).json({ success: false, message: "Account is deactivated" });

    const token = signToken(user);
    console.log("token",token)

    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.created_at,
       dp.id AS doctor_profile_id, dp.specialization, dp.is_approved
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe };