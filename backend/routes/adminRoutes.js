const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate, authorize("admin"));

router.get("/stats", ctrl.getStats);
router.get("/users", ctrl.getAllUsers);
router.get("/doctors/pending", ctrl.getPendingDoctors);
router.patch("/doctors/:id/approve", ctrl.approveDoctor);
router.patch("/doctors/:id/reject", ctrl.rejectDoctor);
router.patch("/users/:id/toggle-active", ctrl.toggleUserActive);
router.get("/appointments", ctrl.getAllAppointments);

module.exports = router;
