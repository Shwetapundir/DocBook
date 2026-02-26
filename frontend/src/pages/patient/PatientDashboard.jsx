import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { appointmentAPI, chatAPI } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  pending:   { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  confirmed: { color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  cancelled: { color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  completed: { color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("");
  const [cancelling, setCancelling]     = useState(null);

  const fetchAppointments = async () => {
    try {
      const params = filter ? { status: filter } : {};
      const res = await appointmentAPI.getAll(params);
      setAppointments(res.data.appointments);
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, [filter]);

  const handleCancel = async (id) => {
    const reason = window.prompt("Reason for cancellation (optional):");
    if (reason === null) return;
    setCancelling(id);
    try {
      await appointmentAPI.cancel(id, reason);
      toast.success("Appointment cancelled");
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancellation failed");
    } finally {
      setCancelling(null);
    }
  };

  const handleStartChat = async (doctorId) => {
    try {
      const res = await chatAPI.startConversation(doctorId);
      window.location.href = `/chat/${res.data.conversation.id}`;
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start chat");
    }
  };

  const upcoming  = appointments.filter(a => ["pending","confirmed"].includes(a.status)).length;
  const completed = appointments.filter(a => a.status === "completed").length;
  const cancelled = appointments.filter(a => a.status === "cancelled").length;

  return (
    <div className="page">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p className="dashboard-greeting">Good day 👋</p>
          <h1>{user.full_name}</h1>
          <p className="text-muted">Manage and track your appointments</p>
        </div>
        <Link to="/doctors" className="btn btn-primary">+ Book Appointment</Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><span className="stat-value">{upcoming}</span><span className="stat-label">Upcoming</span></div>
        <div className="stat-card"><span className="stat-value">{completed}</span><span className="stat-label">Completed</span></div>
        <div className="stat-card"><span className="stat-value">{cancelled}</span><span className="stat-label">Cancelled</span></div>
        <div className="stat-card"><span className="stat-value">{appointments.length}</span><span className="stat-label">Total</span></div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {["", "pending", "confirmed", "completed", "cancelled"].map(s => (
          <button key={s} className={`tab-btn ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-state">Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: "2.5rem" }}>🗓️</p>
          <p>No {filter || ""} appointments found.</p>
          <Link to="/doctors" className="btn btn-primary">Find a Doctor</Link>
        </div>
      ) : (
        <div className="appointment-list">
          {appointments.map(appt => {
            const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
            return (
              <div key={appt.id} className="appt-card-v2">

                {/* Doctor Info */}
                <div className="appt-card-left">
                  <div className="doctor-avatar sm">{appt.doctor_name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="appt-doctor-name">Dr. {appt.doctor_name}</p>
                    <p className="text-sm text-muted">{appt.specialization}</p>
                    <p className="text-sm" style={{ color: "#059669", fontWeight: 600 }}>₹{appt.consultation_fee}</p>
                  </div>
                </div>

                <div className="appt-card-divider" />

                {/* Date & Time */}
                <div className="appt-card-mid">
                  <p className="appt-date-text">
                    📅 {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric"
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    🕐 {appt.start_time?.slice(0,5)} – {appt.end_time?.slice(0,5)}
                  </p>
                  {appt.reason && <p className="appt-reason">"{appt.reason}"</p>}
                </div>

                {/* Status + Actions */}
                <div className="appt-card-right">
                  <span className="appt-status-pill" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    {appt.status}
                  </span>
                  {["pending","confirmed"].includes(appt.status) && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancel(appt.id)} disabled={cancelling === appt.id}>
                      {cancelling === appt.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleStartChat(appt.doctor_id)}
                  >
                    💬 Chat
                  </button>
                  {appt.notes && (
                    <details className="appt-notes-detail">
                      <summary>Doctor's note</summary>
                      <p>{appt.notes}</p>
                    </details>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
