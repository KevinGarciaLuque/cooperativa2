// Sucursal que el personal está viendo ("" = todas). Se guarda en el navegador y viaja en cada
// pedido al servidor en la cabecera X-Sucursal, así cada lista y reporte la respeta sin que
// cada pantalla tenga que pasarla.
import axios from "axios";

const CLAVE = "sucursal_vista";

export const sucursalGuardada = () => {
  try {
    return localStorage.getItem(CLAVE) || "";
  } catch {
    return "";
  }
};

export const guardarSucursal = (id) => {
  try {
    if (id) localStorage.setItem(CLAVE, String(id));
    else localStorage.removeItem(CLAVE);
  } catch {
    // sin almacenamiento: queda "todas"
  }
};

let instalado = false;
export const instalarCabeceraSucursal = () => {
  if (instalado) return;
  instalado = true;
  axios.interceptors.request.use((config) => {
    const id = sucursalGuardada();
    if (id) {
      config.headers = config.headers || {};
      config.headers["X-Sucursal"] = id;
    }
    return config;
  });
};
