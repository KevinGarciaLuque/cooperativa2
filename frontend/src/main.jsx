
import { createRoot } from 'react-dom/client'
import { AlertaProvider } from "./context/AlertaContext";

import "bootstrap/dist/css/bootstrap.min.css";
import "./ui/tokens.css";

import App from './App.jsx'

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
