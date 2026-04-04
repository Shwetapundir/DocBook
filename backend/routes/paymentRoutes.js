const express = require("express");
const router = express.Router();
const { createCheckoutSession, stripeWebhook, verifyPayment } = require("../controllers/paymentController");
const { authenticate } = require("../middleware/auth");

// Stripe webhook — must use raw body, no auth middleware
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// Protected routes
router.post("/create-checkout-session", authenticate, createCheckoutSession);
router.get("/verify", authenticate, verifyPayment);

module.exports = router;
