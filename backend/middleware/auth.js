const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ success: false, message: "No token provided" });
    
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      "SELECT id, full_name, email, role, is_active FROM users WHERE id = $1",
      [decoded.id]
    );
    
    const user = result.rows[0];
    if (!user || !user.is_active)
      return res.status(401).json({ success: false, message: "User not found or deactivated" });
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return res.status(401).json({ success: false, message: "Token expired" });
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ 
      success: false, 
      message: `Access denied. Required: ${roles.join(", ")}` 
    });
  next();
};

module.exports = { authenticate, authorize };