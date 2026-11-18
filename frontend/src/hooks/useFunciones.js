// Funciones nuevas que el Super Administrador enciende en Control de Accesos.
// Devuelve { datos_ampliados: true/false, ... } para el usuario actual (el Super Administrador
// las ve siempre). Se pide una vez y se comparte entre pantallas.
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
let cache = null;
let pedido = null;

export const olvidarFunciones = () => {
  cache = null;
  pedido = null;
};

export function useFunciones() {
  const { token } = useAuth();
  const [funciones, setFunciones] = useState(cache || {});
  useEffect(() => {
    if (!token) return;
    if (cache) {
      setFunciones(cache);
      return;
    }
    pedido =
      pedido ||
      axios
        .get(`${API_URL}/configuracion/funciones`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (cache = r.data.efectivas || {}))
        .catch(() => ({}));
    let activo = true;
    pedido.then((f) => activo && setFunciones(f || {}));
    return () => {
      activo = false;
    };
  }, [token]);
  return funciones;
}
