const pool = require("../config/db");

const bookAppointment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { doctor_id, appointment_date, start_time, reason } = req.body;
    const patientId = req.user.id;

    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const doctorCheck = await client.query(
      `SELECT u.id, dp.is_approved, av.end_time
       FROM users u
       JOIN doctor_profiles dp ON dp.user_id = u.id
       JOIN availability av ON av.doctor_id = u.id
         AND av.is_active = true
         AND av.start_time = $2
         AND av.day_of_week = EXTRACT(DOW FROM $3::date)
       WHERE u.id = $1`,
      [doctor_id, start_time, appointment_date]
    );

    if (!doctorCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Doctor not found or no matching availability slot"
      });
    }

    if (!doctorCheck.rows[0].is_approved) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Doctor is not yet approved" });
    }

    const end_time = doctorCheck.rows[0].end_time;

    const conflict = await client.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1
         AND appointment_date = $2
         AND start_time = $3
         AND status != 'cancelled'
       FOR UPDATE`,
      [doctor_id, appointment_date, start_time]
    );

    if (conflict.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked. Please select another."
      });
    }

    const result = await client.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_date, start_time, end_time, status, reason)
       VALUES ($1,$2,$3,$4,$5,'pending',$6)
       RETURNING *`,
      [patientId, doctor_id, appointment_date, start_time, end_time, reason || null]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, appointment: result.rows[0] });

  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505")
      return res.status(409).json({
        success: false,
        message: "Slot just booked by someone else. Please choose another."
      });
    next(err);
  } finally {
    client.release();
  }
};

const getMyAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT a.id, a.appointment_date, a.start_time, a.end_time,
             a.status, a.reason, a.notes, a.created_at,
             u.id AS doctor_id, u.full_name AS doctor_name,
             dp.specialization, dp.consultation_fee
      FROM appointments a
      JOIN users u ON u.id = a.doctor_id
      LEFT JOIN doctor_profiles dp ON dp.user_id = a.doctor_id
      WHERE a.patient_id = $1`;

    const params = [req.user.id];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    query += " ORDER BY a.appointment_date DESC, a.start_time DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, appointments: result.rows });
  } catch (err) { next(err); }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const { cancel_reason } = req.body;
    const { id } = req.params;

    const apptResult = await pool.query(
      "SELECT * FROM appointments WHERE id = $1", [id]
    );

    const appt = apptResult.rows[0];

    if (!appt)
      return res.status(404).json({ success: false, message: "Appointment not found" });

    if (appt.patient_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized" });

    if (["cancelled", "completed"].includes(appt.status))
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status: ${appt.status}`
      });

    const result = await pool.query(
      `UPDATE appointments
       SET status = 'cancelled', cancelled_by = $1, cancel_reason = $2
       WHERE id = $3 RETURNING *`,
      [req.user.id, cancel_reason || null, id]
    );

    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) { next(err); }
};

const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["confirmed", "completed", "cancelled"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const result = await pool.query(
      `UPDATE appointments SET status = $1
       WHERE id = $2 AND doctor_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Appointment not found" });

    res.json({ success: true, appointment: result.rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
  updateAppointmentStatus
};