import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";

// Admin y otras vistas protegidas
import Actividades from "../pages/Actividades";
import Aportaciones from "../pages/Aportaciones/Aportaciones";
import Bitacora from "../pages/Bitacora";
import Cuentas from "../pages/Cuentas/Cuentas";
import Dashboard from "../pages/Dashboard";
import Home from "../pages/Home";
import Liquidaciones from "../pages/Liquidaciones";
import Login from "../pages/Login";
import Movimientos from "../pages/Movimientos";
import Pagos from "../pages/Pagos";
import Prestamos from "../pages/Prestamos";
import Recuperar from "../pages/Recuperar";
import Reportes from "../pages/Reportes";
import Roles from "../pages/Roles";
import Usuarios from "../pages/Usuarios/Usuarios";
// Vistas de usuario socio
import SocioPerfil from "../pages/Socio/SocioPerfil";
// Vista para restablecimiento por token
import Restablecer from "../pages/Restablecer"; // <-- CREA este archivo si no existe

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function Rutas() {
  const { user, logout } = useAuth();

  return (
    <Routes>
      {/* --- Ruta pública para restablecer contraseña con token --- */}
      <Route path="/recuperar/:token" element={<Restablecer />} />

      {/* --- Rutas públicas --- */}
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/" element={<Home />} />

      {/* --- Panel exclusivo para SOCIO --- */}
      {user && user.rol === "Socio" ? (
        <>
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <SocioPerfil />
              </PrivateRoute>
            }
          />
          {/* Redirección: cualquier otra ruta va a su perfil */}
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        // --- Panel administrativo/completo para otros roles ---
        <Route element={<AppLayout user={user} onLogout={logout} />}>
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PrivateRoute>
                <Usuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <PrivateRoute>
                <Roles />
              </PrivateRoute>
            }
          />
          <Route
            path="/cuentas"
            element={
              <PrivateRoute>
                <Cuentas />
              </PrivateRoute>
            }
          />
          <Route
            path="/prestamos"
            element={
              <PrivateRoute>
                <Prestamos />
              </PrivateRoute>
            }
          />
          <Route
            path="/aportaciones"
            element={
              <PrivateRoute>
                <Aportaciones />
              </PrivateRoute>
            }
          />
          <Route
            path="/pagos"
            element={
              <PrivateRoute>
                <Pagos />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimientos"
            element={
              <PrivateRoute>
                <Movimientos />
              </PrivateRoute>
            }
          />
          <Route
            path="/bitacora"
            element={
              <PrivateRoute>
                <Bitacora />
              </PrivateRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <PrivateRoute>
                <Reportes />
              </PrivateRoute>
            }
          />
          <Route
            path="/actividades"
            element={
              <PrivateRoute>
                <Actividades />
              </PrivateRoute>
            }
          />
          <Route
            path="/liquidaciones"
            element={
              <PrivateRoute>
                <Liquidaciones />
              </PrivateRoute>
            }
          />
        </Route>
      )}

      {/* --- Redirección por defecto --- */}
      <Route
        path="*"
        element={<Navigate to={user ? "/dashboard" : "/login"} />}
      />
    </Routes>
  );
}
