const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");

// POST /api/payments/create-checkout-session
// Called by patient before redirecting to Stripe
const createCheckoutSession = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { doctor_id, appointment_date, start_time, reason } = req.body;
    const patientId = req.user.id;

    if (!doctor_id || !appointment_date || !start_time) {
      return res.status(400).json({ success: false, message: "doctor_id, appointment_date, and start_time are required" });
    }

    // Validate doctor + slot availability (same checks as booking)
    const doctorCheck = await client.query(
      `SELECT u.id, u.full_name, dp.is_approved, dp.consultation_fee, dp.specialization, av.end_time
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
      return res.status(400).json({ success: false, message: "Doctor not found or no matching availability slot" });
    }

    const doctor = doctorCheck.rows[0];

    if (!doctor.is_approved) {
      return res.status(400).json({ success: false, message: "Doctor is not yet approved" });
    }

    // Check slot is not already taken
    const conflict = await client.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND start_time = $3 AND status != 'cancelled'`,
      [doctor_id, appointment_date, start_time]
    );

    if (conflict.rows.length > 0) {
      return res.status(409).json({ success: false, message: "This time slot is already booked. Please select another." });
    }

    const amountInPaise = Math.round(parseFloat(doctor.consultation_fee) * 100);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            unit_amount: amountInPaise,
            product_data: {
              name: `Consultation with Dr. ${doctor.full_name}`,
              description: `${doctor.specialization} | ${appointment_date} at ${start_time.slice(0, 5)}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        patient_id: patientId,
        doctor_id,
        appointment_date,
        start_time,
        reason: reason || "",
        end_time: doctor.end_time,
      },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
    });

    // Store a pending payment record
    await pool.query(
      `INSERT INTO payments (stripe_session_id, patient_id, doctor_id, amount, currency, booking_metadata)
       VALUES ($1, $2, $3, $4, 'inr', $5)
       ON CONFLICT (stripe_session_id) DO NOTHING`,
      [
        session.id,
        patientId,
        doctor_id,
        amountInPaise,
        JSON.stringify({ appointment_date, start_time, end_time: doctor.end_time, reason: reason || null }),
      ]
    );

    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// POST /api/payments/webhook
// Called by Stripe — creates appointment after successful payment
const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await fulfillOrder(session);
  }

  res.json({ received: true });
};

// GET /api/payments/verify?session_id=xxx
// Called by success page as a fallback to ensure appointment was created
const verifyPayment = async (req, res, next) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ success: false, message: "session_id required" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.json({ success: false, message: "Payment not completed" });
    }

    // Check if appointment was already created by webhook
    const paymentRow = await pool.query(
      "SELECT * FROM payments WHERE stripe_session_id = $1",
      [session_id]
    );

    if (!paymentRow.rows.length) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const payment = paymentRow.rows[0];

    // If appointment already exists, return it
    if (payment.appointment_id) {
      const appt = await pool.query("SELECT * FROM appointments WHERE id = $1", [payment.appointment_id]);
      return res.json({ success: true, appointment: appt.rows[0] });
    }

    // Webhook hasn't fired yet — create appointment now
    const appt = await fulfillOrder(session);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    next(err);
  }
};

// Shared logic: create appointment + update payment record
async function fulfillOrder(session) {
  const client = await pool.connect();
  try {
    // Idempotency: skip if already fulfilled
    const existing = await client.query(
      "SELECT * FROM payments WHERE stripe_session_id = $1",
      [session.id]
    );

    if (!existing.rows.length) return null;
    const payment = existing.rows[0];
    if (payment.appointment_id) return null; // already done

    const meta = session.metadata;

    await client.query("BEGIN");

    // Check slot still available (race condition guard)
    const conflict = await client.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND start_time = $3 AND status != 'cancelled'
       FOR UPDATE`,
      [meta.doctor_id, meta.appointment_date, meta.start_time]
    );

    if (conflict.rows.length > 0) {
      // Slot taken — mark payment for review and issue refund
      await client.query(
        "UPDATE payments SET status = 'failed' WHERE stripe_session_id = $1",
        [session.id]
      );
      await client.query("COMMIT");
      console.warn(`Slot conflict after payment for session ${session.id} — manual refund needed`);
      return null;
    }

    const apptResult = await client.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_date, start_time, end_time, status, reason)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6)
       RETURNING *`,
      [
        meta.patient_id,
        meta.doctor_id,
        meta.appointment_date,
        meta.start_time,
        meta.end_time,
        meta.reason || null,
      ]
    );

    const appt = apptResult.rows[0];

    await client.query(
      "UPDATE payments SET status = 'paid', appointment_id = $1 WHERE stripe_session_id = $2",
      [appt.id, session.id]
    );

    await client.query("COMMIT");
    return appt;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("fulfillOrder error:", err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createCheckoutSession, stripeWebhook, verifyPayment };
