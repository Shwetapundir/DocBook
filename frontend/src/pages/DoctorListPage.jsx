import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doctorAPI } from "../api/services";
import toast from "react-hot-toast";

const SPECIALIZATIONS = [
  "Cardiology", "Dermatology", "Neurology", "Orthopedics",
  "Pediatrics", "Psychiatry", "General Medicine", "Gynecology"
];

const DoctorListPage = () => {
  const [doctors, setDoctors]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [specialization, setSpecialization] = useState("");
  const [search, setSearch]             = useState("");
  const [heroSearch, setHeroSearch]     = useState("");

  const fetchDoctors = async (q = search, spec = specialization) => {
    setLoading(true);
    try {
      const params = {};
      if (spec) params.specialization = spec;
      if (q)    params.search = q;
      const res = await doctorAPI.getAll(params);
      setDoctors(res.data.doctors);
    } catch {
      toast.error("Failed to load doctors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDoctors(); }, [specialization]);

  /* Hero search submit */
  const handleHeroSearch = (e) => {
    e.preventDefault();
    setSearch(heroSearch);
    fetchDoctors(heroSearch, specialization);
    /* Smooth scroll to results */
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  };

  /* Filter bar search submit */
  const handleSearch = (e) => {
    e.preventDefault();
    fetchDoctors(search, specialization);
  };

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-inner">
          <h1>Find & Book the Best<br />Doctors Near You</h1>
          <p>Connect with verified specialists and book appointments instantly</p>

          <form onSubmit={handleHeroSearch} className="hero-search">
            <input
              type="text"
              placeholder="Search by doctor name or specialization..."
              value={heroSearch}
              onChange={e => setHeroSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div className="hero-stats">
            <div className="hero-stat"><strong>500+</strong><span>Doctors</span></div>
            <div className="hero-stat"><strong>50k+</strong><span>Patients</span></div>
            <div className="hero-stat"><strong>30+</strong><span>Specialties</span></div>
          </div>
        </div>
      </section>

      {/* ── Results ── */}
      <div className="page" id="results">
        <div className="page-header">
          <h1>Available Doctors</h1>
          <p>Book an appointment with a verified specialist</p>
        </div>

        {/* Filter Bar */}
        <div className="filter-section">
          <div className="filter-bar">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>

            <select
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}
              className="filter-select"
            >
              <option value="">All Specializations</option>
              {SPECIALIZATIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <p className="text-sm text-muted" style={{ marginBottom: "1.25rem" }}>
            Showing <strong>{doctors.length}</strong> doctor{doctors.length !== 1 ? "s" : ""}
            {specialization ? ` in ${specialization}` : ""}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="loading-state">Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div className="empty-state">
            <p>No doctors found. Try adjusting your search or filter.</p>
            <button
              className="btn btn-outline"
              onClick={() => { setSearch(""); setSpecialization(""); fetchDoctors("", ""); }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="doctor-grid">
            {doctors.map(doctor => (
              <div key={doctor.id} className="doctor-card">

                {/* Top: Avatar + Name + Badge */}
                <div className="doctor-card-top">
                  <div className="doctor-avatar">
                    {doctor.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="doctor-info">
                    <h3>Dr. {doctor.full_name}</h3>
                    <div className="doctor-meta-row">
                      <span className="badge">{doctor.specialization}</span>
                    </div>
                  </div>
                </div>

                {/* Body: Details */}
                <div className="doctor-card-body">
                  <div className="info-row">
                    🎓 <span>{doctor.qualification}</span>
                  </div>
                  <div className="info-row">
                    💼 <span>{doctor.experience_years} years experience</span>
                  </div>
                  {doctor.hospital_name && (
                    <div className="info-row">
                      🏥 <span>{doctor.hospital_name}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Fee + Book */}
                <div className="doctor-card-footer">
                  <div>
                    <div className="fee">₹{doctor.consultation_fee}</div>
                    <div className="fee-label">Consultation Fee</div>
                  </div>
                  <Link
                    to={`/doctors/${doctor.id}/book`}
                    className="btn btn-primary btn-sm"
                  >
                    Book Now →
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default DoctorListPage;
