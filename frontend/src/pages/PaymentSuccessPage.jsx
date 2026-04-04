import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { paymentAPI } from "../api/services";

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [appointment, setAppointment] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Verify payment and ensure appointment was created
    paymentAPI.verifyPayment(sessionId)
      .then(res => {
        if (res.data.success) {
          setAppointment(res.data.appointment);
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [sessionId]);

  if (status === "verifying") {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "5rem" }}>
        <div className="loading-state">Confirming your payment...</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "5rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ color: "#DC2626", marginBottom: "0.5rem" }}>Something went wrong</h2>
        <p style={{ color: "#6B7280", marginBottom: "2rem" }}>
          Your payment may have been processed but we couldn't confirm the appointment.
          Please contact support with your session ID: <code>{sessionId}</code>
        </p>
        <button className="btn btn-primary" onClick={() => navigate("/patient/dashboard")}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page-narrow" style={{ margin: "4rem auto", textAlign: "center" }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
      <h1 style={{ color: "#059669", marginBottom: "0.5rem" }}>Payment Successful!</h1>
      <p style={{ color: "#6B7280", marginBottom: "2rem" }}>
        Your appointment has been confirmed.
      </p>

      {appointment && (
        <div style={{
          background: "#F0FDF4", border: "1px solid #BBF7D0",
          borderRadius: "12px", padding: "1.5rem",
          textAlign: "left", marginBottom: "2rem"
        }}>
          <p style={{ fontWeight: 700, color: "#166534", marginBottom: "0.75rem" }}>Appointment Details</p>
          <p>📅 Date: <strong>{appointment.appointment_date}</strong></p>
          <p>🕐 Time: <strong>{appointment.start_time?.slice(0, 5)} – {appointment.end_time?.slice(0, 5)}</strong></p>
          <p>📋 Status: <strong style={{ color: "#059669" }}>Confirmed</strong></p>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => navigate("/patient/dashboard")}>
        View My Appointments
      </button>
    </div>
  );
};

export default PaymentSuccessPage;
