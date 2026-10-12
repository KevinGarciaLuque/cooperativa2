import { BrowserRouter as Router } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import { AlertaProvider } from "./context/AlertaContext"; // <--- Importa tu provider
import Rutas from "./routes/Rutas";
import { useConfigSitio } from "./hooks/useConfigSitio";
import { useEffect } from "react";

function TituloDinamico() {
  const { config } = useConfigSitio();
  useEffect(() => {
    if (config.site_name) document.title = config.site_name;
  }, [config.site_name]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AlertaProvider>
        <Router>
          <TituloDinamico />
          <Rutas />
        </Router>
      </AlertaProvider>
    </AuthProvider>
  );
}
