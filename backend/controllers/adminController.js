const pool = require("../config/db");

const getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.email, u.role, u.phone,
             u.is_active, u.created_at,
             dp.specialization, dp.is_approved
      FROM users u
      LEFT JOIN doctor_profiles dp ON dp.user_id = u.id`;

    const params = [];

    if (role) {
      params.push(role);
      query += ` WHERE u.role = $1`;
    }

    query += " ORDER BY u.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, users: result.rows });
  } catch (err) { next(err); }
};

const getPendingDoctors = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.created_at,
              dp.id AS profile_id, dp.specialization, dp.qualification,
              dp.experience_years, dp.consultation_fee, dp.bio, dp.hospital_name
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE dp.is_approved = false AND u.is_active = true
       ORDER BY u.created_at`
    );

    res.json({ success: true, doctors: result.rows });
  } catch (err) { next(err); }
};

const approveDoctor = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE doctor_profiles
       SET is_approved = true, approved_at = NOW(), approved_by = $1
       WHERE user_id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Doctor profile not found" });

    res.json({ success: true, message: "Doctor approved successfully", profile: result.rows[0] });
  } catch (err) { next(err); }
};

const rejectDoctor = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE doctor_profiles
       SET is_approved = false, approved_at = NULL, approved_by = NULL
       WHERE user_id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Doctor profile not found" });

    res.json({ success: true, message: "Doctor approval revoked" });
  } catch (err) { next(err); }
};

const toggleUserActive = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active
       WHERE id = $1 AND role != 'admin'
       RETURNING id, full_name, email, role, is_active`,
      [req.params.id]
    );

    if (!result.rows.length)
      return res.status(404).json({
        success: false,
        message: "User not found or cannot modify admin"
      });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) { next(err); }
};

const getAllAppointments = async (req, res, next) => {
  try {
    const { status, date, doctor_id } = req.query;

    let query = `
      SELECT a.id, a.appointment_date, a.start_time, a.end_time,
             a.status, a.reason, a.created_at,
             p.full_name AS patient_name, p.email AS patient_email,
             d.full_name AS doctor_name, dp.specialization
      FROM appointments a
      JOIN users p ON p.id = a.patient_id
      JOIN users d ON d.id = a.doctor_id
      LEFT JOIN doctor_profiles dp ON dp.user_id = a.doctor_id
      WHERE 1=1`;

    const params = [];

    if (status)    { params.push(status);    query += ` AND a.status = $${params.length}`; }
    if (date)      { params.push(date);      query += ` AND a.appointment_date = $${params.length}`; }
    if (doctor_id) { params.push(doctor_id); query += ` AND a.doctor_id = $${params.length}`; }

    query += " ORDER BY a.appointment_date DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, appointments: result.rows });
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'patient') AS total_patients,
        (SELECT COUNT(*) FROM users WHERE role = 'doctor') AS total_doctors,
        (SELECT COUNT(*) FROM doctor_profiles WHERE is_approved = false) AS pending_approvals,
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending') AS pending_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'completed') AS completed_appointments
    `);

    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  getAllUsers,
  getPendingDoctors,
  approveDoctor,
  rejectDoctor,
  toggleUserActive,
  getAllAppointments,
  getStats
};
