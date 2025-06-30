import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

export default function Liquidaciones() {
  const { token } = useAuth();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [editLiquidacion, setEditLiquidacion] = useState(null);
  const [form, setForm] = useState({
    fecha: "",
    monto: "",
    descripcion: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [detalle, setDetalle] = useState([]);
  const [showDetalle, setShowDetalle] = useState(false);
  const [liquidacionActual, setLiquidacionActual] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Cargar liquidaciones
  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/liquidaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLiquidaciones(res.data);
    } catch {
      setMsg("No se pudieron obtener las liquidaciones.");
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Crear o editar liquidación
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editLiquidacion) {
        await axios.put(
          `${API_URL}/liquidaciones/${editLiquidacion.id_liquidacion}`,
          form,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMsg("Liquidación actualizada correctamente.");
      } else {
        await axios.post(`${API_URL}/liquidaciones`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMsg("Liquidación registrada correctamente.");
      }
      setForm({ fecha: "", monto: "", descripcion: "" });
      setEditLiquidacion(null);
      fetchData();
    } catch {
      setMsg("Error al guardar la liquidación.");
    }
    setLoading(false);
  };

  const handleEdit = (liq) => {
    setEditLiquidacion(liq);
    setForm({
      fecha: liq.fecha ? liq.fecha.substring(0, 10) : "",
      monto: liq.monto,
      descripcion: liq.descripcion || "",
    });
    setMsg("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta liquidación?"))
      return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/liquidaciones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Liquidación eliminada correctamente.");
      fetchData();
    } catch {
      setMsg("Error al eliminar la liquidación.");
    }
    setLoading(false);
  };

  // Ver detalle de reparto
  const verDetalle = async (liq) => {
    try {
      const res = await axios.get(
        `${API_URL}/liquidaciones/${liq.id_liquidacion}/detalle`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setDetalle(res.data);
      setLiquidacionActual(liq);
      setShowDetalle(true);
    } catch {
      setDetalle([]);
      setLiquidacionActual(liq);
      setShowDetalle(true);
      setMsg("No se pudo obtener el detalle de reparto.");
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Liquidaciones</h2>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-md-3">
          <input
            type="date"
            className="form-control"
            name="fecha"
            value={form.fecha}
            onChange={handleInput}
            required
          />
        </div>
        <div className="col-6 col-md-3">
          <input
            type="number"
            className="form-control"
            name="monto"
            placeholder="Monto total a repartir"
            value={form.monto}
            onChange={handleInput}
            min={0}
            required
          />
        </div>
        <div className="col-12 col-md-4">
          <input
            type="text"
            className="form-control"
            name="descripcion"
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={handleInput}
          />
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button className="btn btn-primary" disabled={loading}>
            {editLiquidacion ? "Actualizar" : "Registrar"}
          </button>
        </div>
        {editLiquidacion && (
          <div className="col-12 col-md-2 d-grid">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditLiquidacion(null);
                setForm({ fecha: "", monto: "", descripcion: "" });
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Monto repartido</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {liquidaciones.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  No hay liquidaciones registradas.
                </td>
              </tr>
            ) : (
              liquidaciones.map((l, i) => (
                <tr key={l.id_liquidacion}>
                  <td>{i + 1}</td>
                  <td>{l.fecha ? l.fecha.substring(0, 10) : "-"}</td>
                  <td>L. {parseFloat(l.monto).toFixed(2)}</td>
                  <td>{l.descripcion}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-info me-1"
                      onClick={() => verDetalle(l)}
                    >
                      Ver detalle
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => handleEdit(l)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(l.id_liquidacion)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para detalle de reparto */}
      <Modal show={showDetalle} onHide={() => setShowDetalle(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Detalle de reparto
            <br />
            <span className="fs-6 text-secondary">
              {liquidacionActual?.fecha?.substring(0, 10)} –{" "}
              {liquidacionActual?.descripcion}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Socio</th>
                  <th>Monto asignado</th>
                </tr>
              </thead>
              <tbody>
                {detalle.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      Sin detalles de reparto.
                    </td>
                  </tr>
                ) : (
                  detalle.map((d, i) => (
                    <tr key={d.id_usuario}>
                      <td>{i + 1}</td>
                      <td>{d.nombre_completo}</td>
                      <td>L. {parseFloat(d.monto_asignado).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalle(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
