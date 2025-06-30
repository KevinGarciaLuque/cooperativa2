import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AlertaProvider } from "./context/AlertaContext"; // <--- Importa tu provider
import Rutas from "./routes/Rutas";

export default function App() {
  return (
    <AuthProvider>
      <AlertaProvider>
        <Router>
          <Rutas />
        </Router>
      </AlertaProvider>
    </AuthProvider>
  );
}
