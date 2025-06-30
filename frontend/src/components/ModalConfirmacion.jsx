// src/components/ModalConfirmacion.jsx
import { FaExclamationTriangle } from "react-icons/fa";

export default function ModalConfirmacion({
  show,
  mensaje,
  onConfirm,
  onCancel,
}) {
  if (!show) return null;
  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "#0008",
        zIndex: 2100,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div
          className="modal-content text-center p-4"
          style={{ borderRadius: 16 }}
        >
          <FaExclamationTriangle size={40} className="text-warning mb-2" />
          <h5 className="mb-3">
            {mensaje || "¿Estás seguro que deseas continuar?"}
          </h5>
          <div className="d-flex justify-content-center gap-3">
            <button className="btn btn-danger px-4" onClick={onConfirm}>
              Sí, eliminar
            </button>
            <button
              className="btn btn-outline-secondary px-4"
              onClick={onCancel}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
