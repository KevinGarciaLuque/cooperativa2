import { Fragment } from "react";
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaBirthdayCake, FaIdCard } from "react-icons/fa";

export default function TablaUsuarios({ usuarios, onEdit, onDelete, onVerPerfil }) {

  const getBadgeColorRol = (rol) => {
    const roles = {
      'Administrador': { bg: 'rgba(231, 76, 60, 0.1)', text: '#e74c3c' },
      'Presidente':    { bg: 'rgba(155, 89, 182, 0.1)', text: '#9b59b6' },
      'Tesorero':      { bg: 'rgba(52, 152, 219, 0.1)',  text: '#3498db' },
      'Socio':         { bg: 'rgba(243, 156, 18, 0.1)',  text: '#f39c12' },
    };
    return roles[rol] || { bg: 'rgba(149, 165, 166, 0.1)', text: '#95a5a6' };
  };

  if (usuarios.length === 0) {
    return (
      <div className="card border-0 shadow-sm text-center py-5" style={{ borderRadius: "15px" }}>
        <div className="mb-3" style={{ fontSize: "48px", opacity: 0.3 }}>👥</div>
        <h5 className="text-muted">No se encontraron usuarios</h5>
        <p className="text-muted small">Intenta con otros filtros de búsqueda</p>
      </div>
    );
  }

  return (
    <>
      {/* ── TABLA: pantallas lg+ ── */}
      <div className="card border-0 shadow-sm d-none d-lg-block" style={{ borderRadius: "15px", overflow: "hidden" }}>
        <div style={{ maxHeight: "520px", overflowY: "auto" }}>
        <table className="table table-hover align-middle mb-0">
          <thead style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th style={{ padding: "14px 12px", borderBottom: "none", width: "48px" }}>#</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Nombre Completo</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>DNI</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Contacto</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Dirección</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Nacimiento</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Rol</th>
              <th className="text-center" style={{ padding: "14px 12px", borderBottom: "none" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((user, i) => {
              const rolColors = getBadgeColorRol(user.rol);
              return (
                <Fragment key={user.id_usuario}>
                  <tr
                    onClick={() => onVerPerfil && onVerPerfil(user)}
                    style={{
                      cursor: "pointer",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(102,126,234,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "14px 12px" }}>
                      <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold"
                        style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", fontSize: "12px" }}
                      >
                        {i + 1}
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <span className="fw-semibold" style={{ color: "#2c3e50" }}>{user.nombre_completo}</span>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <div className="d-flex align-items-center text-muted small">
                        <FaIdCard className="me-1 flex-shrink-0" />{user.dni}
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px", maxWidth: "180px" }}>
                      <div className="d-flex align-items-center text-muted small mb-1">
                        <FaPhone className="me-1 flex-shrink-0" />{user.telefono || "—"}
                      </div>
                      <div className="d-flex align-items-center text-muted small">
                        <FaEnvelope className="me-1 flex-shrink-0" />
                        <span className="text-truncate">{user.correo || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px", maxWidth: "140px" }}>
                      <div className="d-flex align-items-center text-muted small">
                        <FaMapMarkerAlt className="me-1 flex-shrink-0" />
                        <span className="text-truncate">{user.direccion || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <div className="d-flex align-items-center text-muted small">
                        <FaBirthdayCake className="me-1 flex-shrink-0" />{user.fecha_nacimiento?.substring(0, 10) || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <span className="badge px-3 py-2" style={{ background: rolColors.bg, color: rolColors.text, fontWeight: "600", borderRadius: "8px" }}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="text-center" style={{ padding: "14px 12px" }}>
                      <span
                        className="badge px-3 py-2"
                        style={{
                          background: user.estado === "activo" ? "rgba(39,174,96,0.1)" : "rgba(149,165,166,0.1)",
                          color: user.estado === "activo" ? "#27ae60" : "#95a5a6",
                          fontWeight: "600", borderRadius: "20px", textTransform: "capitalize"
                        }}
                      >
                        {user.estado}
                      </span>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        <div className="bg-light text-center py-2 border-top">
          <small className="text-muted">
            Mostrando <strong>{usuarios.length}</strong> usuario{usuarios.length !== 1 ? "s" : ""}
          </small>
        </div>
      </div>

      {/* ── TARJETAS: pantallas menores a lg ── */}
      <div className="d-lg-none">
        <div className="row g-3">
          {usuarios.map((user, i) => {
            const rolColors = getBadgeColorRol(user.rol);
            return (
              <div className="col-12 col-sm-6" key={user.id_usuario}>
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "15px", overflow: "hidden", cursor: "pointer", border: "2px solid transparent", transition: "border 0.15s" }}
                  onClick={() => onVerPerfil && onVerPerfil(user)}
                  onMouseEnter={(e) => (e.currentTarget.style.border = "2px solid #667eea")}
                  onMouseLeave={(e) => (e.currentTarget.style.border = "2px solid transparent")}
                >
                  {/* Cabecera */}
                  <div
                    className="d-flex align-items-center px-3 py-3"
                    style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                        style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.25)", color: "white", fontSize: "13px" }}
                      >
                        {i + 1}
                      </div>
                      <span className="fw-bold text-white" style={{ fontSize: "14px" }}>{user.nombre_completo}</span>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="card-body py-3 px-3">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className="badge px-2 py-1" style={{ background: rolColors.bg, color: rolColors.text, fontWeight: "600", borderRadius: "8px" }}>
                        {user.rol}
                      </span>
                      <span
                        className="badge px-2 py-1"
                        style={{
                          background: user.estado === "activo" ? "rgba(39,174,96,0.1)" : "rgba(149,165,166,0.1)",
                          color: user.estado === "activo" ? "#27ae60" : "#95a5a6",
                          fontWeight: "600", borderRadius: "20px", textTransform: "capitalize"
                        }}
                      >
                        {user.estado}
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-1" style={{ fontSize: "13px", color: "#555" }}>
                      <div className="d-flex align-items-center gap-2">
                        <FaIdCard style={{ color: "#667eea", flexShrink: 0 }} />{user.dni}
                      </div>
                      {user.telefono && (
                        <div className="d-flex align-items-center gap-2">
                          <FaPhone style={{ color: "#667eea", flexShrink: 0 }} />{user.telefono}
                        </div>
                      )}
                      {user.correo && (
                        <div className="d-flex align-items-center gap-2">
                          <FaEnvelope style={{ color: "#667eea", flexShrink: 0 }} />
                          <span className="text-truncate">{user.correo}</span>
                        </div>
                      )}
                      {user.direccion && (
                        <div className="d-flex align-items-center gap-2">
                          <FaMapMarkerAlt style={{ color: "#667eea", flexShrink: 0 }} />{user.direccion}
                        </div>
                      )}
                      {user.fecha_nacimiento && (
                        <div className="d-flex align-items-center gap-2">
                          <FaBirthdayCake style={{ color: "#667eea", flexShrink: 0 }} />{user.fecha_nacimiento?.substring(0, 10)}
                        </div>
                      )}
                    </div>

                    {/* Toque para ver perfil */}
                    <p className="mb-0 text-muted small mt-2" style={{ fontSize: "11px" }}>
                      Toca para ver perfil y acciones
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center mt-3">
          <small className="text-muted">
            Mostrando <strong>{usuarios.length}</strong> usuario{usuarios.length !== 1 ? "s" : ""}
          </small>
        </div>
      </div>
    </>
  );
}
