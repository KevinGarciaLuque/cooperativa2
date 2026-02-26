import { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const login = async (dni, password) => {
    try {
      const res = await axios.post(`${API_URL}/usuarios/login`, {
        dni,
        password,
      });
      setUser(res.data.usuario);
      setToken(res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.usuario));
      localStorage.setItem("token", res.data.token);
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
