import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import Navbar from "./components/common/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DoctorListPage from "./pages/DoctorListPage";
import BookAppointmentPage from "./pages/BookAppointmentPage";
import PatientDashboard from "./pages/patient/PatientDashboard";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorProfilePage from "./pages/doctor/DoctorProfilePage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ChatPage from "./pages/ChatPage";
import "./index.css";

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/doctors" replace />} />
        <Route path="/doctors" element={<DoctorListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/patient/dashboard" element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <PatientDashboard />
          </ProtectedRoute>
        } />

        <Route path="/doctors/:id/book" element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <BookAppointmentPage />
          </ProtectedRoute>
        } />

        <Route path="/doctor/dashboard" element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DoctorDashboard />
          </ProtectedRoute>
        } />

        <Route path="/doctor/profile" element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DoctorProfilePage />
          </ProtectedRoute>
        } />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/chat" element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <ChatPage />
          </ProtectedRoute>
        } />
        
        <Route path="/chat/:conversationId" element={
          <ProtectedRoute allowedRoles={["patient", "doctor"]}>
            <ChatPage />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={
          <div className="page" style={{ textAlign: "center", paddingTop: "5rem" }}>
            <h1>404 - Page Not Found</h1>
          </div>
        } />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;