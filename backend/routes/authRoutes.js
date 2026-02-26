const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { registerRules, loginRules, handleValidation } = require("../middleware/validate");

router.post("/register", registerRules, handleValidation, register);
router.post("/login", loginRules, handleValidation, login);
router.get("/me", authenticate, getMe);

module.exports = router;