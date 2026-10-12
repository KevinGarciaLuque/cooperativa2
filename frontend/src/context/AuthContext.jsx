import { createContext, useContext, useEffect, useState } from "react";
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
      // Mensaje del servidor (por ejemplo, bloqueo temporal por demasiados intentos)
      const status = error.response?.status;
      return status === 429 ? error.response.data?.message || false : false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // Si el servidor indica que la sesión ya no es válida (expiró o la cuenta se
  // desactivó), se cierra la sesión y se vuelve al inicio de sesión.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (r) => r,
      (error) => {
        const url = error.config?.url || "";
        const esAuth = url.includes("/usuarios/login") || url.includes("/recuperar");
        if (error.response?.status === 401 && !esAuth && localStorage.getItem("token")) {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const updateUser = (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
