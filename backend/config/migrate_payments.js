require("dotenv").config();
const pool = require("./db");

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
        patient_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        doctor_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appointment_id    UUID REFERENCES appointments(id) ON DELETE SET NULL,
        amount            INTEGER NOT NULL,
        currency          VARCHAR(10) DEFAULT 'inr',
        status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
        booking_metadata  JSONB NOT NULL DEFAULT '{}',
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_payments_session  ON payments(stripe_session_id);

      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
      CREATE TRIGGER trg_payments_updated_at
        BEFORE UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
    console.log("✅ Payments table migration complete");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
