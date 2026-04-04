const pool = require("../config/db");

const upsertProfile = async (req, res, next) => {
  try {
    const { specialization, qualification, experience_years, consultation_fee, bio, hospital_name } = req.body;

    const result = await pool.query(
      `INSERT INTO doctor_profiles 
       (user_id, specialization, qualification, experience_years, consultation_fee, bio, hospital_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
       specialization = EXCLUDED.specialization,
       qualification = EXCLUDED.qualification,
       experience_years = EXCLUDED.experience_years,
       consultation_fee = EXCLUDED.consultation_fee,
       bio = EXCLUDED.bio,
       hospital_name = EXCLUDED.hospital_name
       RETURNING *`,
      [req.user.id, specialization, qualification, experience_years, consultation_fee, bio, hospital_name]
    );

    res.json({ success: true, profile: result.rows[0] });
  } catch (err) { next(err); }
};

const getDoctors = async (req, res, next) => {
  try {
    const { specialization, search } = req.query;

    let query = `
      SELECT u.id, u.full_name, u.email, u.phone,
             dp.id AS profile_id, dp.specialization, dp.qualification,
             dp.experience_years, dp.consultation_fee, dp.bio, dp.hospital_name
      FROM users u
      JOIN doctor_profiles dp ON dp.user_id = u.id
      WHERE u.is_active = true AND dp.is_approved = true`;

    const params = [];

    if (specialization) {
      params.push(`%${specialization}%`);
      query += ` AND LOWER(dp.specialization) LIKE LOWER($${params.length})`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(u.full_name) LIKE LOWER($${params.length}) OR LOWER(dp.specialization) LIKE LOWER($${params.length}))`;
    }

    query += " ORDER BY u.full_name";

    const result = await pool.query(query, params);
    console.log(result.rows)
    res.json({ success: true, count: result.rows.length, doctors: result.rows });
  } catch (err) { next(err); }
};

const getDoctorById = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone,
              dp.specialization, dp.qualification,
              dp.experience_years, dp.consultation_fee, dp.bio, dp.hospital_name
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND dp.is_approved = true`,
      [req.params.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Doctor not found" });

    res.json({ success: true, doctor: result.rows[0] });
  } catch (err) { next(err); }
};

const getDoctorAvailability = async (req, res, next) => {
  try {
    const { id: doctorId } = req.params;
    const { date } = req.query;

    if (!date)
      return res.status(400).json({ success: false, message: "date query param required (YYYY-MM-DD)" });

    const dayOfWeek = new Date(date + "T00:00:00").getDay();

    const slotsResult = await pool.query(
      `SELECT id, start_time, end_time FROM availability
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true
       ORDER BY start_time`,
      [doctorId, dayOfWeek]
    );

    const bookedResult = await pool.query(
      `SELECT start_time FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'cancelled'`,
      [doctorId, date]
    );

    const bookedTimes = new Set(bookedResult.rows.map(r => r.start_time));
    const availableSlots = slotsResult.rows.filter(slot => !bookedTimes.has(slot.start_time));

    res.json({ success: true, date, available_slots: availableSlots });
  } catch (err) { next(err); }
};

const addAvailability = async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time } = req.body;

    if (end_time <= start_time)
      return res.status(400).json({ success: false, message: "end_time must be after start_time" });

    const result = await pool.query(
      `INSERT INTO availability (doctor_id, day_of_week, start_time, end_time)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, day_of_week, start_time, end_time]
    );

    res.status(201).json({ success: true, slot: result.rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ success: false, message: "This slot already exists" });
    next(err);
  }
};

const removeAvailability = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE availability SET is_active = false
       WHERE id = $1 AND doctor_id = $2 RETURNING id`,
      [req.params.slotId, req.user.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Slot not found" });

    res.json({ success: true, message: "Slot removed" });
  } catch (err) { next(err); }
};

const getDoctorAppointments = async (req, res, next) => {
  try {
    const { status, date } = req.query;

    let query = `
      SELECT a.id, a.appointment_date, a.start_time, a.end_time,
             a.status, a.reason, a.notes,
             u.id AS patient_id, u.full_name AS patient_name,
             u.email AS patient_email, u.phone AS patient_phone
      FROM appointments a
      JOIN users u ON u.id = a.patient_id
      WHERE a.doctor_id = $1`;

    const params = [req.user.id];

    if (status) { params.push(status); query += ` AND a.status = $${params.length}`; }
    if (date)   { params.push(date);   query += ` AND a.appointment_date = $${params.length}`; }

    query += " ORDER BY a.appointment_date, a.start_time";

    const result = await pool.query(query, params);
    res.json({ success: true, appointments: result.rows });
  } catch (err) { next(err); }
};

const updateAppointmentNotes = async (req, res, next) => {
  try {
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE appointments SET notes = $1
       WHERE id = $2 AND doctor_id = $3 RETURNING *`,
      [notes, req.params.id, req.user.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Appointment not found" });

    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  upsertProfile,
  getDoctors,
  getDoctorById,
  getDoctorAvailability,
  addAvailability,
  removeAvailability,
  getDoctorAppointments,
  updateAppointmentNotes
};