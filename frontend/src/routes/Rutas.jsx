import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PaginaSkeleton } from "../ui/Componentes";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";

// Admin y otras vistas protegidas
const Actividades = lazy(() => import("../pages/Actividades"));
const Aportaciones = lazy(() => import("../pages/Aportaciones/Aportaciones"));
const BaseDatos = lazy(() => import("../pages/BaseDatos"));
const Bitacora = lazy(() => import("../pages/Bitacora"));
const Cuentas = lazy(() => import("../pages/Cuentas/Cuentas"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Home = lazy(() => import("../pages/Home"));
const Liquidaciones = lazy(() => import("../pages/Liquidaciones"));
const Login = lazy(() => import("../pages/Login"));
const Movimientos = lazy(() => import("../pages/Movimientos"));
const Pagos = lazy(() => import("../pages/Pagos"));
const Prestamos = lazy(() => import("../pages/Prestamos"));
const Recuperar = lazy(() => import("../pages/Recuperar"));
const Reportes = lazy(() => import("../pages/Reportes"));
const Roles = lazy(() => import("../pages/Roles"));
const Usuarios = lazy(() => import("../pages/Usuarios/Usuarios"));
const Ventanilla = lazy(() => import("../pages/Ventanilla"));
const Caja = lazy(() => import("../pages/Caja"));
const Cobranza = lazy(() => import("../pages/Cobranza"));
const Contabilidad = lazy(() => import("../pages/Contabilidad"));
const Registro = lazy(() => import("../pages/Registro"));
const Solicitudes = lazy(() => import("../pages/Solicitudes"));
const ParametrosFinancieros = lazy(() => import("../pages/SuperAdmin/ParametrosFinancieros"));
const Politicas = lazy(() => import("../pages/SuperAdmin/Politicas"));
// Vistas de usuario socio
const SocioPerfil = lazy(() => import("../pages/Socio/SocioPerfil"));
// Vista para restablecimiento por token
const Restablecer = lazy(() => import("../pages/Restablecer")); // <-- CREA este archivo si no existe
// Super Administrador
const SuperAdmin = lazy(() => import("../pages/SuperAdmin/SuperAdmin"));
const Configuracion = lazy(() => import("../pages/SuperAdmin/Configuracion"));
// Perfil de usuario
const MiPerfil = lazy(() => import("../pages/MiPerfil"));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function Rutas() {
  const { user, logout } = useAuth();

  return (
    <Suspense fallback={<PaginaSkeleton />}>
    <Routes>
      {/* --- Ruta pública para restablecer contraseña con token --- */}
      <Route path="/recuperar/:token" element={<Restablecer />} />

      {/* --- Rutas públicas --- */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
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
            path="/ventanilla"
            element={
              <PrivateRoute>
                <Ventanilla />
              </PrivateRoute>
            }
          />
          <Route
            path="/contabilidad"
            element={
              <PrivateRoute>
                <Contabilidad />
              </PrivateRoute>
            }
          />
          <Route
            path="/solicitudes"
            element={
              <PrivateRoute>
                <Solicitudes />
              </PrivateRoute>
            }
          />
          <Route
            path="/cobranza"
            element={
              <PrivateRoute>
                <Cobranza />
              </PrivateRoute>
            }
          />
          <Route
            path="/caja"
            element={
              <PrivateRoute>
                <Caja />
              </PrivateRoute>
            }
          />
          <Route
            path="/parametros-financieros"
            element={
              <PrivateRoute>
                <ParametrosFinancieros />
              </PrivateRoute>
            }
          />
          <Route
            path="/politicas"
            element={
              <PrivateRoute>
                <Politicas />
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
          <Route
            path="/basedatos"
            element={
              <PrivateRoute>
                <BaseDatos />
              </PrivateRoute>
            }
          />
          <Route
            path="/superadmin"
            element={
              <PrivateRoute>
                <SuperAdmin />
              </PrivateRoute>
            }
          />
          <Route
            path="/configuracion"
            element={
              <PrivateRoute>
                <Configuracion />
              </PrivateRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <PrivateRoute>
                <MiPerfil />
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
    </Suspense>
  );
}
