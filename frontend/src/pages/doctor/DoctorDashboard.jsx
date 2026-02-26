import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doctorAPI } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const STATUS_CONFIG = {
  pending:   { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  confirmed: { color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  cancelled: { color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  completed: { color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
};

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("appointments");
  const [newSlot, setNewSlot]           = useState({ day_of_week: 1, start_time: "09:00", end_time: "09:30" });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await doctorAPI.getMyAppointments();
        setAppointments(res.data.appointments);
      } catch {
        toast.error("Failed to load appointments");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleStatusUpdate = async (id, status) => {
    try {
      await doctorAPI.updateAppointmentStatus(id, status);
      toast.success(`Appointment marked as ${status}`);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    try {
      const res = await doctorAPI.addAvailability(newSlot);
      setAvailability(prev => [...prev, res.data.slot]);
      toast.success("Slot added successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add slot");
    }
  };

  const handleRemoveSlot = async (slotId) => {
    try {
      await doctorAPI.removeAvailability(slotId);
      setAvailability(prev => prev.filter(s => s.id !== slotId));
      toast.success("Slot removed");
    } catch {
      toast.error("Failed to remove slot");
    }
  };

  const pending   = appointments.filter(a => a.status === "pending").length;
  const confirmed = appointments.filter(a => a.status === "confirmed").length;
  const completed = appointments.filter(a => a.status === "completed").length;

  if (loading) return <div className="loading-state">Loading dashboard...</div>;

  return (
    <div className="page">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p className="dashboard-greeting">Welcome back 👨‍⚕️</p>
          <h1>Dr. {user.full_name}</h1>
          <p className="text-muted">Manage your appointments and availability</p>
        </div>
        <Link to="/doctor/profile" className="btn btn-outline">Edit Profile</Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><span className="stat-value">{pending}</span><span className="stat-label">Pending</span></div>
        <div className="stat-card"><span className="stat-value">{confirmed}</span><span className="stat-label">Confirmed</span></div>
        <div className="stat-card"><span className="stat-value">{completed}</span><span className="stat-label">Completed</span></div>
        <div className="stat-card"><span className="stat-value">{appointments.length}</span><span className="stat-label">Total</span></div>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === "appointments" ? "active" : ""}`} onClick={() => setActiveTab("appointments")}>
          Appointments {pending > 0 && <span className="tab-badge">{pending}</span>}
        </button>
        <button className={`tab-btn ${activeTab === "availability" ? "active" : ""}`} onClick={() => setActiveTab("availability")}>
          Availability
        </button>
      </div>

      {/* Appointments Tab */}
      {activeTab === "appointments" && (
        <div className="appointment-list">
          {appointments.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem" }}>📋</p>
              <p>No appointments yet. Complete your profile and add availability slots.</p>
              <Link to="/doctor/profile" className="btn btn-primary">Complete Profile</Link>
            </div>
          ) : appointments.map(appt => {
            const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
            return (
              <div key={appt.id} className="appt-card-v2">

                {/* Patient Info */}
                <div className="appt-card-left">
                  <div className="doctor-avatar sm">{appt.patient_name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="appt-doctor-name">{appt.patient_name}</p>
                    <p className="text-sm text-muted">{appt.patient_email}</p>
                    {appt.patient_phone && <p className="text-sm text-muted">📞 {appt.patient_phone}</p>}
                  </div>
                </div>

                <div className="appt-card-divider" />

                {/* Date & Reason */}
                <div className="appt-card-mid">
                  <p className="appt-date-text">
                    📅 {new Date(appt.appointment_date).toLocaleDateString("en-IN", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric"
                    })}
                  </p>
                  <p className="text-sm text-muted">🕐 {appt.start_time?.slice(0,5)}</p>
                  {appt.reason && <p className="appt-reason">"{appt.reason}"</p>}
                </div>

                {/* Actions */}
                <div className="appt-card-right">
                  <span className="appt-status-pill" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    {appt.status}
                  </span>

                  {appt.status === "pending" && (
                    <div className="btn-group">
                      <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(appt.id, "confirmed")}>✓ Confirm</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(appt.id, "cancelled")}>✕ Cancel</button>
                    </div>
                  )}
                  {appt.status === "confirmed" && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(appt.id, "completed")}>
                      Mark Complete
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Availability Tab */}
      {activeTab === "availability" && (
        <div className="availability-section">

          {/* Add Slot Form */}
          <div className="card">
            <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem" }}>Add Availability Slot</h3>
            <form onSubmit={handleAddSlot} className="slot-form">
              <div className="form-group">
                <label>Day of Week</label>
                <select value={newSlot.day_of_week} onChange={e => setNewSlot(p => ({ ...p, day_of_week: +e.target.value }))}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={newSlot.start_time} onChange={e => setNewSlot(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={newSlot.end_time} onChange={e => setNewSlot(p => ({ ...p, end_time: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>Add Slot</button>
            </form>
          </div>

          {/* Slot List */}
          {availability.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem" }}>
              <p>No slots added yet. Add your available time slots above.</p>
            </div>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Your Availability Slots</h3>
              <div className="slot-list">
                {availability.map(slot => (
                  <div key={slot.id} className="slot-item">
                    <span className="slot-day-badge">{DAY_SHORT[slot.day_of_week]}</span>
                    <span style={{ fontWeight: 600 }}>
                      {slot.start_time?.slice(0,5)} – {slot.end_time?.slice(0,5)}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveSlot(slot.id)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
