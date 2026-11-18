import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const guardarSesion = (data) => {
    setUser(data.usuario);
    setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.usuario));
    localStorage.setItem("token", data.token);
  };

  // Mensaje del servidor que vale la pena mostrar (bloqueo, cuenta inactiva, correo caído...)
  const mensajeDe = (error) => {
    const status = error.response?.status;
    return [403, 429, 503].includes(status) ? error.response.data?.message || false : false;
  };

  // Devuelve true (sesión abierta), { requiere_codigo, token_temporal, correo } (falta el código
  // del correo), un texto con el motivo o false
  const login = async (dni, password) => {
    try {
      const res = await axios.post(`${API_URL}/usuarios/login`, {
        dni,
        password,
      });
      if (res.data.requiere_codigo) return res.data;
      guardarSesion(res.data);
      return true;
    } catch (error) {
      return mensajeDe(error);
    }
  };

  // Segundo paso: el código que llegó al correo. Devuelve true o el mensaje de error
  const verificarCodigo = async (token_temporal, codigo) => {
    try {
      const res = await axios.post(`${API_URL}/usuarios/login/verificar`, { token_temporal, codigo });
      guardarSesion(res.data);
      return true;
    } catch (error) {
      return error.response?.data?.message || "No se pudo verificar el código.";
    }
  };

  const reenviarCodigo = async (token_temporal) => {
    try {
      const res = await axios.post(`${API_URL}/usuarios/login/reenviar`, { token_temporal });
      return res.data;
    } catch (error) {
      return error.response?.data?.message || "No se pudo reenviar el código.";
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("sucursal_vista"); // la próxima sesión empieza viendo todas
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
    <AuthContext.Provider value={{ user, token, login, verificarCodigo, reenviarCodigo, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
