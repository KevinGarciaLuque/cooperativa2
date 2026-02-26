import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from "react-icons/fa";

export default function AlertaModal({
  show,
  tipo = "success",
  mensaje,
  onClose,
}) {
  if (!show) return null;

  // Configuración de estilos según el tipo
  const configTipo = {
    success: {
      icon: <FaCheckCircle style={{ fontSize: "60px", color: "#27ae60" }} />,
      title: "¡Éxito!",
      gradient: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
      bgColor: "#27ae6020",
    },
    error: {
      icon: <FaTimesCircle style={{ fontSize: "60px", color: "#e74c3c" }} />,
      title: "Error",
      gradient: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
      bgColor: "#e74c3c20",
    },
    warning: {
      icon: <FaExclamationTriangle style={{ fontSize: "60px", color: "#f39c12" }} />,
      title: "Advertencia",
      gradient: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
      bgColor: "#f39c1220",
    },
    info: {
      icon: <FaInfoCircle style={{ fontSize: "60px", color: "#3498db" }} />,
      title: "Información",
      gradient: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
      bgColor: "#3498db20",
    },
  };

  const config = configTipo[tipo] || configTipo.info;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 2200,
      }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-content border-0 shadow-lg"
          style={{
            borderRadius: "20px",
            overflow: "hidden",
            animation: "modalSlideDown 0.3s ease-out",
          }}
        >
          {/* Header con gradiente */}
          <div
            className="text-center py-4"
            style={{
              background: config.gradient,
            }}
          >
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
              style={{
                width: "100px",
                height: "100px",
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
              }}
            >
              {config.icon}
            </div>
          </div>

          {/* Body */}
          <div className="modal-body text-center px-4 py-4">
            <h4 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
              {config.title}
            </h4>
            <p className="mb-0" style={{ color: "#7f8c8d", fontSize: "16px", lineHeight: "1.6" }}>
              {mensaje}
            </p>
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 justify-content-center pb-4">
            <button
              className="btn btn-lg shadow-sm px-5"
              onClick={onClose}
              style={{
                background: config.gradient,
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: "600",
                fontSize: "16px",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideDown {
          from {
            opacity: 0;
            transform: translateY(-50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
