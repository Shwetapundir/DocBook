import React from "react";
import { useNavigate } from "react-router-dom";

const PaymentCancelPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page-narrow" style={{ margin: "4rem auto", textAlign: "center" }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
      <h1 style={{ color: "#DC2626", marginBottom: "0.5rem" }}>Payment Cancelled</h1>
      <p style={{ color: "#6B7280", marginBottom: "2rem" }}>
        You cancelled the payment. Your appointment was not booked and you have not been charged.
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Try Again
        </button>
        <button className="btn btn-primary" onClick={() => navigate("/doctors")}>
          Browse Doctors
        </button>
      </div>
    </div>
  );
};

export default PaymentCancelPage;
