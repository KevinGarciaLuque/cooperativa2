// Acciones que puede hacer el usuario de la sesión (función "permisos_por_accion").
// puede("pagos.anular") → false si a su rol se le quitó esa acción o si es de solo lectura,
// para esconder el botón. Con la función apagada (o Super Administrador) todo está permitido.
// El servidor siempre vuelve a comprobarlo: esto solo evita mostrar botones que no sirven.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
let cache = null;
let pedido = null;
let deToken = null;

export const olvidarAcciones = () => {
  cache = null;
  pedido = null;
  deToken = null;
};

export function useAcciones() {
  const { token, user } = useAuth();
  const [datos, setDatos] = useState(cache);

  useEffect(() => {
    if (!token || user?.rol === "Socio") return;
    if (deToken !== token) olvidarAcciones();
    deToken = token;
    if (cache) return setDatos(cache);
    pedido =
      pedido ||
      axios
        .get(`${API_URL}/permisos/mis-acciones`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (cache = r.data))
        .catch(() => (cache = { activa: false, acciones: {} }));
    let vigente = true;
    pedido.then((d) => vigente && setDatos(d));
    return () => {
      vigente = false;
    };
  }, [token, user?.rol]);

  const puede = useCallback(
    (clave) => {
      if (!datos || !datos.activa) return true;
      if (datos.solo_lectura) return false;
      return datos.acciones?.[clave] !== false;
    },
    [datos]
  );

  return { puede, soloLectura: !!datos?.activa && !!datos?.solo_lectura };
}
