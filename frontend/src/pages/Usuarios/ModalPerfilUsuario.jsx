import {
  FaUser,
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaBirthdayCake,
  FaUserTag,
  FaEdit,
  FaTrash,
  FaTimes,
} from "react-icons/fa";

export default function ModalPerfilUsuario({ show, usuario, onClose, onEdit, onDelete }) {
  if (!show || !usuario) return null;

  const API_BASE =
    import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

  const fotoSrc = usuario.foto ? `${API_BASE}${usuario.foto}` : null;

  const getBadgeColors = (rol) => {
    const map = {
      Administrador: { bg: "rgba(231,76,60,0.1)", text: "#e74c3c" },
      Presidente: { bg: "rgba(155,89,182,0.1)", text: "#9b59b6" },
      Tesorero: { bg: "rgba(52,152,219,0.1)", text: "#3498db" },
      Socio: { bg: "rgba(243,156,18,0.1)", text: "#f39c12" },
    };
    return map[rol] || { bg: "rgba(149,165,166,0.1)", text: "#95a5a6" };
  };

  const rolColors = getBadgeColors(usuario.rol);

  const InfoRow = ({ icon, label, value }) => (
    <div
      className="d-flex align-items-start gap-3 p-3"
      style={{
        background: "rgba(102,126,234,0.05)",
        borderRadius: "10px",
        border: "1px solid rgba(102,126,234,0.1)",
      }}
    >
      <div
        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
        style={{
          width: "36px",
          height: "36px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="mb-0 small text-muted">{label}</p>
        <p className="mb-0 fw-semibold text-truncate" style={{ color: "#2c3e50" }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1300,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-md modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{ borderRadius: "20px", overflow: "hidden" }}
        >
          {/* Header con gradiente y foto */}
          <div
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              padding: "28px 24px 60px",
              position: "relative",
            }}
          >
            <button
              type="button"
              className="btn p-1 d-flex align-items-center justify-content-center"
              onClick={onClose}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                border: "none",
              }}
            >
              <FaTimes size={14} />
            </button>
            <h5 className="text-white fw-bold mb-1 text-center">Perfil de Usuario</h5>
            <p className="text-white text-center mb-0" style={{ opacity: 0.8, fontSize: "13px" }}>
              {usuario.nombre_completo}
            </p>
          </div>

          {/* Avatar centrado superpuesto */}
          <div
            className="d-flex justify-content-center"
            style={{ marginTop: "-48px", marginBottom: "0", position: "relative", zIndex: 1 }}
          >
            <div
              className="rounded-circle d-flex align-items-center justify-content-center overflow-hidden"
              style={{
                width: "96px",
                height: "96px",
                background: fotoSrc
                  ? "transparent"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "4px solid white",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            >
              {fotoSrc ? (
                <img
                  src={fotoSrc}
                  alt={usuario.nombre_completo}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentNode.innerHTML =
                      '<span style="font-size:40px;color:white">👤</span>';
                  }}
                />
              ) : (
                <FaUser style={{ fontSize: "40px", color: "white" }} />
              )}
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{ padding: "16px 24px 24px" }}>
            {/* Nombre y badges */}
            <div className="text-center mb-4">
              <h5 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>
                {usuario.nombre_completo}
              </h5>
              <div className="d-flex justify-content-center gap-2 flex-wrap">
                <span
                  className="badge px-3 py-2"
                  style={{
                    background: rolColors.bg,
                    color: rolColors.text,
                    fontWeight: "600",
                    borderRadius: "8px",
                  }}
                >
                  <FaUserTag className="me-1" size={11} />
                  {usuario.rol}
                </span>
                <span
                  className="badge px-3 py-2"
                  style={{
                    background:
                      usuario.estado === "activo"
                        ? "rgba(39,174,96,0.1)"
                        : "rgba(149,165,166,0.1)",
                    color: usuario.estado === "activo" ? "#27ae60" : "#95a5a6",
                    fontWeight: "600",
                    borderRadius: "20px",
                    textTransform: "capitalize",
                  }}
                >
                  {usuario.estado}
                </span>
              </div>
            </div>

            {/* Datos */}
            <div className="row g-2 mb-4">
              <div className="col-12">
                <InfoRow icon={<FaIdCard size={14} />} label="DNI" value={usuario.dni} />
              </div>
              <div className="col-12 col-sm-6">
                <InfoRow
                  icon={<FaPhone size={14} />}
                  label="Teléfono"
                  value={usuario.telefono}
                />
              </div>
              <div className="col-12 col-sm-6">
                <InfoRow
                  icon={<FaBirthdayCake size={14} />}
                  label="Nacimiento"
                  value={usuario.fecha_nacimiento?.substring(0, 10)}
                />
              </div>
              <div className="col-12">
                <InfoRow
                  icon={<FaEnvelope size={14} />}
                  label="Correo"
                  value={usuario.correo}
                />
              </div>
              <div className="col-12">
                <InfoRow
                  icon={<FaMapMarkerAlt size={14} />}
                  label="Dirección"
                  value={usuario.direccion}
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="row g-2">
              <div className="col-6">
                <button
                  className="btn w-100"
                  onClick={() => { onClose(); onEdit(usuario); }}
                  style={{
                    background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "600",
                    padding: "12px",
                  }}
                >
                  <FaEdit className="me-2" />
                  Editar
                </button>
              </div>
              <div className="col-6">
                <button
                  className="btn w-100"
                  onClick={() => { onClose(); onDelete(usuario.id_usuario); }}
                  style={{
                    background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "600",
                    padding: "12px",
                  }}
                >
                  <FaTrash className="me-2" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
