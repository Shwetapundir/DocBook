const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/doctorController");
const { authenticate, authorize } = require("../middleware/auth");
const { doctorProfileRules, availabilityRules, handleValidation } = require("../middleware/validate");

router.get("/", ctrl.getDoctors);
router.get("/me/appointments", authenticate, authorize("doctor"), ctrl.getDoctorAppointments);
router.get("/:id", ctrl.getDoctorById);
router.get("/:id/availability", ctrl.getDoctorAvailability);
router.post("/profile", authenticate, authorize("doctor"), doctorProfileRules, handleValidation, ctrl.upsertProfile);
router.post("/availability", authenticate, authorize("doctor"), availabilityRules, handleValidation, ctrl.addAvailability);
router.delete("/availability/:slotId", authenticate, authorize("doctor"), ctrl.removeAvailability);
router.patch("/appointments/:id/notes", authenticate, authorize("doctor"), ctrl.updateAppointmentNotes);

module.exports = router;