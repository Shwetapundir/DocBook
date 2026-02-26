const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/appointmentController");
const { authenticate, authorize } = require("../middleware/auth");
const { appointmentRules, handleValidation } = require("../middleware/validate");

router.use(authenticate);

router.post("/", authorize("patient"), appointmentRules, handleValidation, ctrl.bookAppointment);
router.get("/", authorize("patient"), ctrl.getMyAppointments);
router.patch("/:id/cancel", authorize("patient"), ctrl.cancelAppointment);
router.patch("/:id/status", authorize("doctor"), ctrl.updateAppointmentStatus);

module.exports = router;