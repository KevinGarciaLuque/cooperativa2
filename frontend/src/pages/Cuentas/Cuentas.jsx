import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import TablaCuenta from "./TablaCuenta";
import AccionesCuenta from "./AccionesCuenta";
import { FaPiggyBank, FaSearch } from "react-icons/fa";

export default function Cuentas() {
  const { token } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [editCuenta, setEditCuenta] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    tipo_cuenta: "",
    saldo: "",
    estado: "activa",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Obtener cuentas y usuarios
  const fetchData = async () => {
    try {
      const [cuentasRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/cuentas`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setCuentas(cuentasRes.data);
      setUsuarios(usuariosRes.data);
    } catch {
      setMsg("No se pudieron obtener los datos.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Filtrar cuentas
  const cuentasFiltradas = cuentas.filter((c) => {
    const usuario = usuarios.find((u) => u.id_usuario === c.id_usuario);
    const nombreUsuario = usuario?.nombre_completo?.toLowerCase() || "";
    return (
      nombreUsuario.includes(filtro.toLowerCase()) ||
      c.tipo_cuenta.toLowerCase().includes(filtro.toLowerCase())
    );
  });

  // Acciones: Crear/Editar/Eliminar
  const handleEdit = (cuenta) => {
    setEditCuenta(cuenta);
    setForm({
      id_usuario: cuenta.id_usuario,
      tipo_cuenta: cuenta.tipo_cuenta,
      saldo: cuenta.saldo,
      estado: cuenta.estado,
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta cuenta?")) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/cuentas/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Cuenta eliminada correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar la cuenta.");
    }
    setLoading(false);
  };

  const handleFormChange = (nuevoForm) => setForm(nuevoForm);

  return (
    <div className="container-fluid py-4">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white py-3 border-bottom">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 d-flex align-items-center">
              <FaPiggyBank className="me-2 text-primary" />
              <span>Gestión de Cuentas</span>
            </h5>
            <div
              className="input-group input-group-sm"
              style={{ width: "250px" }}
            >
              <span className="input-group-text bg-light border-end-0">
                <FaSearch className="text-muted" />
              </span>
              <input
                type="search"
                className="form-control form-control-sm border-start-0"
                placeholder="Buscar cuenta o socio..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="card-body">
          {msg && (
            <div
              className={`alert alert-${
                msg.includes("Error") ? "danger" : "success"
              } alert-dismissible fade show`}
            >
              {msg}
              <button
                type="button"
                className="btn-close"
                onClick={() => setMsg("")}
              ></button>
            </div>
          )}

          {/* Acciones y formulario */}
          <AccionesCuenta
            form={form}
            setForm={handleFormChange}
            editCuenta={editCuenta}
            setEditCuenta={setEditCuenta}
            setMsg={setMsg}
            usuarios={usuarios}
            loading={loading}
            setLoading={setLoading}
            fetchData={fetchData}
          />

          {/* Tabla */}
          <TablaCuenta
            cuentas={cuentasFiltradas}
            usuarios={usuarios}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
