import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chatAPI } from "../../api/services";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate                          = useNavigate();
  const [unreadCount, setUnreadCount]     = useState(0);

  // Poll for unread messages every 5 seconds when logged in
  useEffect(() => {
    if (!isAuthenticated || user?.role === "admin") return;

    const fetchUnread = async () => {
      try {
        const res = await chatAPI.getConversations();
        const total = res.data.conversations.reduce(
          (sum, c) => sum + (parseInt(c.unread_count) || 0), 0
        );
        setUnreadCount(total);
      } catch {
        // silently fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getDashboardLink = () => {
    if (!user) return "/";
    return `/${user.role}/dashboard`;
  };

  return (
    <nav className="navbar">

      {/* Brand */}
      <div className="navbar-brand">
        <Link to="/">DocBook</Link>
      </div>

      {/* Links */}
      <div className="navbar-links">
        <Link to="/doctors">Find Doctors</Link>

        {isAuthenticated && user?.role !== "admin" && (
          <Link to="/chat" style={{ position: "relative" }}>
            Messages
            {unreadCount > 0 && (
              <span className="navbar-unread-badge">{unreadCount}</span>
            )}
          </Link>
        )}

        {isAuthenticated ? (
          <>
            <Link to={getDashboardLink()}>Dashboard</Link>
            <span className="navbar-user">
              {user.full_name}
              <span className="navbar-role-badge">{user.role}</span>
            </span>
            <button onClick={handleLogout} className="btn-outline-sm">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-outline-sm">Login</Link>
            <Link to="/register" className="btn-primary-sm">Get Started</Link>
          </>
        )}
      </div>

    </nav>
  );
};

export default Navbar;
