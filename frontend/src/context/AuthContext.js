import React, { createContext, useContext, useReducer, useEffect } from "react";
import { authAPI } from "../api/services";

const initialState = {
  user: null,
  token: localStorage.getItem("token") || null,
  loading: true,
  isAuthenticated: false
};

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      localStorage.setItem("token", action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false
      };
    case "LOGOUT":
      localStorage.removeItem("token");
      return { ...initialState, loading: false, token: null };
    case "SET_USER":
      return { ...state, user: action.payload, isAuthenticated: true, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }
      try {
        const res = await authAPI.getMe();
        dispatch({ type: "SET_USER", payload: res.data.user });
      } catch {
        dispatch({ type: "LOGOUT" });
      }
    };
    verifyToken();
  }, []);

  const login = async (credentials) => {
    const res = await authAPI.login(credentials);
    dispatch({ type: "LOGIN_SUCCESS", payload: res.data });
    return res.data;
  };

  const register = async (userData) => {
    const res = await authAPI.register(userData);
    dispatch({ type: "LOGIN_SUCCESS", payload: res.data });
    return res.data;
  };

  const logout = () => dispatch({ type: "LOGOUT" });

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
