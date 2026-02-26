import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const RegisterPage = () => {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "patient", phone: ""
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await register(form);
      toast.success(data.message);
      const dashboard = {
        patient: "/patient/dashboard",
        doctor:  "/doctor/dashboard"
      }[data.user.role];
      navigate(dashboard);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors?.length) errors.forEach(e => toast.error(e.message));
      else toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="auth-subtitle">Join DocBook today</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Jane Smith"
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min 8 characters"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone (optional)</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1234567890"
            />
          </div>

          <div className="form-group">
            <label>Register as</label>
            <div className="role-selector">
              {["patient", "doctor"].map(role => (
                <label
                  key={role}
                  className={`role-option ${form.role === role ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={form.role === role}
                    onChange={handleChange}
                  />
                  {role === "patient" ? "Patient" : "Doctor"}
                </label>
              ))}
            </div>
          </div>

          {form.role === "doctor" && (
            <p className="info-note">
              Doctor accounts require admin approval before accepting bookings.
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
