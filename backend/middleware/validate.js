const { body, validationResult } = require("express-validator");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  next();
};

const registerRules = [
  body("full_name").trim().notEmpty().withMessage("Full name is required").isLength({ min: 2, max: 100 }),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").isIn(["patient", "doctor"]).withMessage("Role must be patient or doctor"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const doctorProfileRules = [
  body("specialization").trim().notEmpty().withMessage("Specialization is required"),
  body("qualification").trim().notEmpty().withMessage("Qualification is required"),
  body("experience_years").isInt({ min: 0 }).withMessage("Experience must be a non-negative integer"),
  body("consultation_fee").isFloat({ min: 0 }).withMessage("Fee must be non-negative"),
];

const availabilityRules = [
  body("day_of_week").isInt({ min: 0, max: 6 }).withMessage("day_of_week must be 0-6"),
  body("start_time").matches(/^([0-1]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage("start_time must be HH:MM"),
  body("end_time").matches(/^([0-1]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage("end_time must be HH:MM"),
];

const appointmentRules = [
  body("doctor_id").isUUID().withMessage("doctor_id must be a valid UUID"),
  body("appointment_date").isDate().withMessage("appointment_date must be YYYY-MM-DD"),
  body("start_time").matches(/^([0-1]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage("start_time must be HH:MM"),
];

module.exports = {
  handleValidation,
  registerRules,
  loginRules,
  doctorProfileRules,
  availabilityRules,
  appointmentRules
};
