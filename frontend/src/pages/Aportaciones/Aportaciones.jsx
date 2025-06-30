import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import TablaAportaciones from "./TablaAportaciones";
import AccionesAportaciones from "./AccionesAportaciones";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import AlertaModal from "../../components/AlertaModal";

export default function Aportaciones() {
  const { token } = useAuth();
  const [aportaciones, setAportaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [editAportacion, setEditAportacion] = useState(null);
  const [form, setForm] = useState({
    id_usuario: "",
    monto: "",
    fecha: "",
    descripcion: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // MODAL CONFIRMACION
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    id: null,
  });

  // ALERTA MODAL
  const [alerta, setAlerta] = useState({
    show: false,
    tipo: "success",
    mensaje: "",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const fetchData = async () => {
    try {
      const [aportacionesRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/aportaciones`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setAportaciones(aportacionesRes.data);
      setUsuarios(usuariosRes.data);
    } catch {
      setMsg("No se pudieron obtener los datos.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Maneja borrar
  const handleDelete = (id) => {
    setConfirmModal({ show: true, id });
  };

  const confirmarEliminar = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/aportaciones/${confirmModal.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerta({
        show: true,
        tipo: "success",
        mensaje: "Aportación eliminada correctamente.",
      });
      fetchData();
    } catch {
      setAlerta({
        show: true,
        tipo: "error",
        mensaje: "Error al eliminar la aportación.",
      });
    }
    setLoading(false);
    setConfirmModal({ show: false, id: null });
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Aportaciones</h2>
      <AccionesAportaciones
        form={form}
        setForm={setForm}
        editAportacion={editAportacion}
        setEditAportacion={setEditAportacion}
        setMsg={setMsg}
        usuarios={usuarios}
        loading={loading}
        setLoading={setLoading}
        fetchData={fetchData}
      />
      <TablaAportaciones
        aportaciones={aportaciones}
        usuarios={usuarios}
        onEdit={setEditAportacion}
        onDelete={handleDelete}
      />

      {/* Modal de confirmación */}
      <ModalConfirmacion
        show={confirmModal.show}
        mensaje="¿Seguro que deseas eliminar esta aportación?"
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmModal({ show: false, id: null })}
        loading={loading}
      />

      {/* Modal de alerta */}
      <AlertaModal
        show={alerta.show}
        tipo={alerta.tipo}
        mensaje={alerta.mensaje}
        onClose={() => setAlerta({ show: false, tipo: "success", mensaje: "" })}
      />
    </div>
  );
}
