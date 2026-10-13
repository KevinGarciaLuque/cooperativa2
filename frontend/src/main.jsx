
import { createRoot } from 'react-dom/client'
import { AlertaProvider } from "./context/AlertaContext";

import "bootstrap/dist/css/bootstrap.min.css";
import "./ui/tokens.css";

import App from './App.jsx'

// Si se publicó una versión nueva mientras la pestaña seguía abierta, los archivos de las
// pantallas de la versión anterior ya no existen: se recarga para traer la versión nueva
// (como máximo una vez por minuto, para no entrar en un ciclo si el servidor falla).
window.addEventListener("vite:preloadError", (evento) => {
  try {
    const ultima = Number(sessionStorage.getItem("recarga_version") || 0);
    if (Date.now() - ultima < 60000) return;
    sessionStorage.setItem("recarga_version", String(Date.now()));
  } catch {
    // sin almacenamiento: se recarga igual
  }
  evento.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <AlertaProvider>
    <App />
  </AlertaProvider>
);

// Permite instalar la aplicación en el celular (solo en producción)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sin soporte o bloqueado: la aplicación funciona igual
    });
  });
}
