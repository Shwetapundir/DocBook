import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doctorAPI } from "../../api/services";
import toast from "react-hot-toast";

const SPECIALIZATIONS = [
  "Cardiology","Dermatology","Neurology","Orthopedics",
  "Pediatrics","Psychiatry","General Medicine","Gynecology",
  "Ophthalmology","ENT","Urology","Oncology","Radiology","Dentistry"
];

const DoctorProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    specialization:   "",
    qualification:    "",
    experience_years: "",
    consultation_fee: "",
    bio:              "",
    hospital_name:    ""
  });

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await doctorAPI.upsertProfile(form);
      toast.success("Profile saved! Awaiting admin approval.");
      navigate("/doctor/dashboard");
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors?.length) errors.forEach(e => toast.error(e.message));
      else toast.error(err.response?.data?.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-narrow" style={{ margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ marginBottom: "1rem" }}>
          ← Back
        </button>
        <h1>Doctor Profile</h1>
        <p className="text-muted" style={{ marginTop: "0.35rem" }}>
          Complete your profile to start receiving patient appointments.
        </p>
      </div>

      {/* Info Banner */}
      <div className="info-note" style={{ marginBottom: "1.75rem" }}>
        ℹ️ After saving, your profile will be reviewed by an admin before going live. This usually takes less than 24 hours.
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="profile-form">

        {/* Section: Basic Info */}
        <p className="profile-section-label">Basic Information</p>

        <div className="form-row">
          <div className="form-group">
            <label>Specialization *</label>
            <select name="specialization" value={form.specialization} onChange={handleChange} required>
              <option value="">Select your specialization</option>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Qualification *</label>
            <input
              type="text"
              name="qualification"
              value={form.qualification}
              onChange={handleChange}
              placeholder="e.g. MBBS, MD, MS..."
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Years of Experience *</label>
            <input
              type="number"
              name="experience_years"
              value={form.experience_years}
              onChange={handleChange}
              placeholder="e.g. 5"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label>Consultation Fee (₹) *</label>
            <input
              type="number"
              name="consultation_fee"
              value={form.consultation_fee}
              onChange={handleChange}
              placeholder="e.g. 500"
              min="0"
              required
            />
          </div>
        </div>

        {/* Section: Workplace */}
        <div className="profile-section-divider" />
        <p className="profile-section-label">Workplace</p>

        <div className="form-group">
          <label>Hospital / Clinic Name</label>
          <input
            type="text"
            name="hospital_name"
            value={form.hospital_name}
            onChange={handleChange}
            placeholder="e.g. Apollo Hospital, City Clinic..."
          />
        </div>

        {/* Section: Bio */}
        <div className="profile-section-divider" />
        <p className="profile-section-label">About You</p>

        <div className="form-group">
          <label>Professional Bio</label>
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            rows={4}
            placeholder="Write a brief professional bio that patients will see. Mention your expertise, approach, and any specialties..."
          />
          <p className="text-xs text-muted" style={{ marginTop: "0.3rem" }}>
            {form.bio.length}/500 characters
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary btn-full btn-large"
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? (
            <><span className="btn-spinner"></span> Saving Profile...</>
          ) : (
            "Save Profile →"
          )}
        </button>

      </form>
    </div>
  );
};

export default DoctorProfilePage;
