import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import TablaUsuarios from "./TablaUsuarios";
import ModalAcciones from "./ModalAcciones";
import ModalConfirmacion from "../../components/ModalConfirmacion"; // IMPORTANTE

export default function Usuarios() {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [modal, setModal] = useState({
    open: false,
    tipo: "crear",
    usuario: null,
  });
  const [filtro, setFiltro] = useState("");
  const [msg, setMsg] = useState("");

  // Para controlar el modal de confirmación de borrado
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    id: null,
  });
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const fetchUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(res.data);
    } catch (err) {
      setMsg("No se pudieron obtener los usuarios.");
    }
  };

  useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line
  }, []);

  const openCrear = () =>
    setModal({ open: true, tipo: "crear", usuario: null });
  const openEditar = (usuario) =>
    setModal({ open: true, tipo: "editar", usuario });
  const closeModal = () => setModal({ open: false, tipo: "", usuario: null });

  // Abre modal confirmación antes de eliminar
  const handleEliminar = (id) => {
    setConfirmModal({ show: true, id });
  };

  // Lógica de eliminación real
  const confirmarEliminar = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/usuarios/${confirmModal.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Usuario eliminado correctamente.");
      fetchUsuarios();
    } catch (err) {
      setMsg("Error al eliminar el usuario.");
    }
    setLoading(false);
    setConfirmModal({ show: false, id: null });
  };

  // Filtro de búsqueda por nombre/dni/correo
  const usuariosFiltrados = usuarios.filter((u) =>
    [u.nombre_completo, u.dni, u.correo]
      .join(" ")
      .toLowerCase()
      .includes(filtro.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="mb-0">Usuarios</h2>
        <button className="btn btn-success" onClick={openCrear}>
          Registrar usuario
        </button>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}
      <TablaUsuarios
        usuarios={usuariosFiltrados}
        onEdit={openEditar}
        onDelete={handleEliminar}
        filtro={filtro}
        setFiltro={setFiltro}
      />
      <ModalAcciones
        show={modal.open}
        tipo={modal.tipo}
        usuario={modal.usuario}
        onClose={closeModal}
        onRefresh={fetchUsuarios}
        setMsg={setMsg}
      />

      {/* Modal Confirmación Eliminar */}
      <ModalConfirmacion
        show={confirmModal.show}
        mensaje="¿Seguro que deseas eliminar este usuario?"
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmModal({ show: false, id: null })}
        loading={loading}
      />
    </div>
  );
}
