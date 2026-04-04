import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doctorAPI, paymentAPI } from "../api/services";
import toast from "react-hot-toast";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const BookAppointmentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor]           = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason]           = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking]         = useState(false);

  useEffect(() => {
    doctorAPI.getById(id)
      .then(res => setDoctor(res.data.doctor))
      .catch(() => { toast.error("Doctor not found"); navigate("/doctors"); });
  }, [id]);

  const handleDateChange = async (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedSlot(null);
    if (!date) return;
    setLoadingSlots(true);
    try {
      const res = await doctorAPI.getAvailability(id, date);
      setAvailableSlots(res.data.available_slots);
    } catch {
      toast.error("Could not load availability");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot) return toast.error("Please select a date and time slot");
    setBooking(true);
    try {
      const res = await paymentAPI.createCheckoutSession({
        doctor_id: id,
        appointment_date: selectedDate,
        start_time: selectedSlot.start_time,
        reason
      });
      // Redirect to Stripe hosted checkout
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not initiate payment");
      setBooking(false);
    }
  };

  const today   = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  if (!doctor) return <div className="loading-state">Loading doctor info...</div>;

  return (
    <div className="page-narrow" style={{ margin: "0 auto" }}>

      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ marginBottom: "1.5rem" }}>
        ← Back to Doctors
      </button>

      {/* Doctor Summary Card */}
      <div className="doctor-summary-card">
        <div className="doctor-avatar large">{doctor.full_name.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <h2>Dr. {doctor.full_name}</h2>
          <span className="badge">{doctor.specialization}</span>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <div>
              <p className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Qualification</p>
              <p className="text-sm" style={{ fontWeight: 600 }}>{doctor.qualification}</p>
            </div>
            <div>
              <p className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Experience</p>
              <p className="text-sm" style={{ fontWeight: 600 }}>{doctor.experience_years} years</p>
            </div>
            <div>
              <p className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Fee</p>
              <p className="text-sm" style={{ fontWeight: 700, color: "#059669", fontSize: "1rem" }}>₹{doctor.consultation_fee}</p>
            </div>
          </div>
          {doctor.hospital_name && (
            <p className="text-sm text-muted" style={{ marginTop: "0.5rem" }}>🏥 {doctor.hospital_name}</p>
          )}
        </div>
      </div>

      {/* Step 1: Select Date */}
      <div className="booking-step">
        <h3>Step 1 — Select Date</h3>
        <input
          type="date"
          className="date-input"
          value={selectedDate}
          onChange={handleDateChange}
          min={today}
          max={maxDate}
        />
        {selectedDate && (
          <p className="date-label">
            📅 {DAY_NAMES[new Date(selectedDate + "T00:00:00").getDay()]}, {selectedDate}
          </p>
        )}
      </div>

      {/* Step 2: Select Slot */}
      {selectedDate && (
        <div className="booking-step">
          <h3>Step 2 — Select Time Slot</h3>
          {loadingSlots ? (
            <p className="text-muted text-sm">Loading available slots...</p>
          ) : availableSlots.length === 0 ? (
            <div style={{ padding: "1rem", background: "#FEF2F2", borderRadius: "8px", color: "#DC2626", fontSize: "0.875rem" }}>
              ❌ No slots available on this date. Please try another date.
            </div>
          ) : (
            <div className="slot-grid">
              {availableSlots.map(slot => (
                <button
                  key={slot.id}
                  className={`slot-btn ${selectedSlot?.id === slot.id ? "selected" : ""}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Reason */}
      {selectedSlot && (
        <div className="booking-step">
          <h3>Step 3 — Reason for Visit <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.8rem" }}>(optional)</span></h3>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Briefly describe your symptoms or reason for visit..."
            rows={3}
            className="textarea-input"
          />
        </div>
      )}

      {/* Booking Summary */}
      {selectedSlot && (
        <div style={{
          background: "#EFF6FF", border: "1px solid #DBEAFE",
          borderRadius: "12px", padding: "1.25rem 1.5rem",
          marginBottom: "1rem", fontSize: "0.88rem"
        }}>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#1E3A8A" }}>📋 Booking Summary</p>
          <p>👨‍⚕️ Dr. {doctor.full_name} — {doctor.specialization}</p>
          <p>📅 {selectedDate} at {selectedSlot.start_time.slice(0,5)}</p>
          <p>💰 Consultation Fee: <strong style={{ color: "#059669" }}>₹{doctor.consultation_fee}</strong></p>
        </div>
      )}

      {/* Confirm Button */}
      <button
        className="btn btn-primary btn-full btn-large"
        onClick={handleBook}
        disabled={!selectedSlot || booking}
      >
        {booking ? (
          <><span className="btn-spinner"></span> Redirecting to payment...</>
        ) : (
          "Pay & Book →"
        )}
      </button>

    </div>
  );
};

export default BookAppointmentPage;
