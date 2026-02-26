import React, { useState, useEffect } from "react";
import { adminAPI } from "../../api/services";
import toast from "react-hot-toast";

const AdminDashboard = () => {
  const [stats, setStats]               = useState(null);
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [allUsers, setAllUsers]         = useState([]);
  const [activeTab, setActiveTab]       = useState("overview");
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, pendingRes, usersRes] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getPendingDoctors(),
          adminAPI.getUsers()
        ]);
        setStats(statsRes.data.stats);
        setPendingDoctors(pendingRes.data.doctors);
        setAllUsers(usersRes.data.users);
      } catch {
        toast.error("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveDoctor(id);
      toast.success("Doctor approved!");
      setPendingDoctors(prev => prev.filter(d => d.id !== id));
      setStats(prev => ({ ...prev, pending_approvals: prev.pending_approvals - 1 }));
    } catch {
      toast.error("Failed to approve doctor");
    }
  };

  const handleReject = async (id) => {
    try {
      await adminAPI.rejectDoctor(id);
      toast.success("Doctor rejected");
      setPendingDoctors(prev => prev.filter(d => d.id !== id));
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await adminAPI.toggleUserActive(id);
      toast.success(`User ${res.data.user.is_active ? "activated" : "deactivated"}`);
      setAllUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.data.user.is_active } : u));
    } catch {
      toast.error("Failed to update user");
    }
  };

  if (loading) return <div className="loading-state">Loading admin data...</div>;

  const ROLE_COLORS = { patient: "#059669", doctor: "#1D4ED8", admin: "#7C3AED" };
  const ROLE_BG     = { patient: "#ECFDF5", doctor: "#EFF6FF", admin: "#F5F3FF" };

  return (
    <div className="page">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p className="dashboard-greeting">Admin Panel 🛡️</p>
          <h1>System Dashboard</h1>
          <p className="text-muted">Manage doctors, patients and platform activity</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{stats.total_patients}</span>
            <span className="stat-label">Patients</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total_doctors}</span>
            <span className="stat-label">Doctors</span>
          </div>
          <div className="stat-card stat-highlight">
            <span className="stat-value" style={{ color: "#D97706" }}>{stats.pending_approvals}</span>
            <span className="stat-label">Pending Approvals</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total_appointments}</span>
            <span className="stat-label">Appointments</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.completed_appointments}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button className={`tab-btn ${activeTab === "pending" ? "active" : ""}`} onClick={() => setActiveTab("pending")}>
          Pending Doctors
          {pendingDoctors.length > 0 && <span className="tab-badge">{pendingDoctors.length}</span>}
        </button>
        <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
          All Users
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="admin-overview-grid">
          <div className="card">
            <h3 style={{ marginBottom: "0.5rem" }}>Quick Summary</h3>
            <p className="text-muted" style={{ fontSize: "0.9rem" }}>Platform health at a glance</p>
            <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                { label: "Approval Rate", value: stats ? `${Math.round((stats.total_doctors - stats.pending_approvals) / Math.max(stats.total_doctors,1) * 100)}%` : "—", color: "#059669" },
                { label: "Completion Rate", value: stats ? `${Math.round(stats.completed_appointments / Math.max(stats.total_appointments,1) * 100)}%` : "—", color: "#1D4ED8" },
                { label: "Pending Appointments", value: stats?.pending_appointments || 0, color: "#D97706" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 0", borderBottom: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: "0.88rem", color: "#475569" }}>{item.label}</span>
                  <span style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {pendingDoctors.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid #D97706" }}>
              <h3 style={{ marginBottom: "0.5rem", color: "#D97706" }}>⚠️ Action Required</h3>
              <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                {pendingDoctors.length} doctor{pendingDoctors.length > 1 ? "s" : ""} waiting for approval
              </p>
              <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => setActiveTab("pending")}>
                Review Now →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Doctors Tab */}
      {activeTab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {pendingDoctors.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: "2.5rem" }}>✅</p>
              <p>No pending doctor approvals. You're all caught up!</p>
            </div>
          ) : pendingDoctors.map(doc => (
            <div key={doc.id} className="card doctor-approval-card">
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <div className="doctor-avatar sm">{doc.full_name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <h3 style={{ fontSize: "1rem" }}>Dr. {doc.full_name}</h3>
                    <p className="text-sm text-muted">{doc.email}</p>
                  </div>
                </div>
                <div className="doctor-meta">
                  <span className="badge">{doc.specialization}</span>
                  <span className="text-sm">🎓 {doc.qualification}</span>
                  <span className="text-sm">💼 {doc.experience_years} yrs exp</span>
                  <span className="text-sm" style={{ color: "#059669", fontWeight: 600 }}>₹{doc.consultation_fee}</span>
                </div>
                {doc.hospital_name && <p className="text-sm text-muted" style={{ marginTop: "0.35rem" }}>🏥 {doc.hospital_name}</p>}
                {doc.bio && <p className="text-sm text-muted" style={{ marginTop: "0.4rem", fontStyle: "italic" }}>"{doc.bio}"</p>}
              </div>
              <div className="btn-group">
                <button className="btn btn-success" onClick={() => handleApprove(doc.id)}>✓ Approve</button>
                <button className="btn btn-danger" onClick={() => handleReject(doc.id)}>✕ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: "#0F172A" }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span style={{
                      display: "inline-block", padding: "0.2rem 0.65rem", borderRadius: "999px",
                      fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize",
                      color: ROLE_COLORS[u.role], background: ROLE_BG[u.role]
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.35rem",
                      fontSize: "0.85rem", fontWeight: 600,
                      color: u.is_active ? "#059669" : "#DC2626"
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.is_active ? "#059669" : "#DC2626", display: "inline-block" }} />
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ color: "#94A3B8" }}>{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    {u.role !== "admin" && (
                      <button
                        className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}
                        onClick={() => handleToggleActive(u.id)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
