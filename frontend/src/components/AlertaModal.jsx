import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

export default function AlertaModal({
  show,
  tipo = "success",
  mensaje,
  onClose,
}) {
  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "#0008",
        zIndex: 2200,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div
          className="modal-content text-center py-4"
          style={{ borderRadius: 16 }}
        >
          <div className="mb-2">
            {tipo === "success" ? (
              <FaCheckCircle size={42} className="text-success mb-1" />
            ) : (
              <FaExclamationTriangle size={42} className="text-danger mb-1" />
            )}
          </div>
          <div className="fw-bold mb-3" style={{ fontSize: 20 }}>
            {mensaje}
          </div>
          <button className="btn btn-success px-4 fw-bold" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
