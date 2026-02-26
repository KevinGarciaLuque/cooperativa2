import { Fragment, useState } from "react";
import { FaEdit, FaTrash, FaEnvelope, FaPhone, FaMapMarkerAlt, FaBirthdayCake, FaIdCard, FaChevronDown, FaChevronUp } from "react-icons/fa";

export default function TablaUsuarios({ usuarios, onEdit, onDelete }) {
  const [selectedId, setSelectedId] = useState(null);

  const getBadgeColorRol = (rol) => {
    const roles = {
      'Administrador': { bg: 'rgba(231, 76, 60, 0.1)', text: '#e74c3c' },
      'Presidente':    { bg: 'rgba(155, 89, 182, 0.1)', text: '#9b59b6' },
      'Tesorero':      { bg: 'rgba(52, 152, 219, 0.1)',  text: '#3498db' },
      'Socio':         { bg: 'rgba(243, 156, 18, 0.1)',  text: '#f39c12' },
    };
    return roles[rol] || { bg: 'rgba(149, 165, 166, 0.1)', text: '#95a5a6' };
  };

  const toggleSelected = (id) => setSelectedId(prev => prev === id ? null : id);

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
        <table className="table table-hover align-middle mb-0">
          <thead style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
            <tr>
              <th style={{ padding: "14px 12px", borderBottom: "none", width: "48px" }}>#</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Nombre Completo</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>DNI</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Contacto</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Dirección</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Nacimiento</th>
              <th style={{ padding: "14px 12px", borderBottom: "none" }}>Rol</th>
              <th className="text-center" style={{ padding: "14px 12px", borderBottom: "none" }}>Estado</th>
              <th className="text-center" style={{ padding: "14px 12px", borderBottom: "none", width: "48px" }}></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((user, i) => {
              const rolColors = getBadgeColorRol(user.rol);
              const isOpen = selectedId === user.id_usuario;
              return (
                <Fragment key={user.id_usuario}>
                  <tr
                    onClick={() => toggleSelected(user.id_usuario)}
                    style={{
                      cursor: "pointer",
                      background: isOpen ? "rgba(102,126,234,0.06)" : undefined,
                      transition: "background 0.15s"
                    }}
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
                    <td className="text-center" style={{ padding: "14px 12px", color: "#667eea" }}>
                      {isOpen ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                    </td>
                  </tr>

                  {/* Fila de acciones expandible */}
                  {isOpen && (
                    <tr style={{ background: "rgba(102,126,234,0.04)" }}>
                      <td colSpan={9} style={{ padding: "10px 16px 14px", borderTop: "none" }}>
                        <div className="d-flex align-items-center gap-3">
                          <span className="text-muted small me-2">Acciones para <strong>{user.nombre_completo}</strong>:</span>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => { e.stopPropagation(); onEdit(user); }}
                            style={{ background: "rgba(52,152,219,0.1)", color: "#3498db", border: "1px solid rgba(52,152,219,0.3)", borderRadius: "8px", padding: "6px 16px", fontWeight: "600" }}
                          >
                            <FaEdit className="me-2" size={13} />Editar
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => { e.stopPropagation(); onDelete(user.id_usuario); }}
                            style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.3)", borderRadius: "8px", padding: "6px 16px", fontWeight: "600" }}
                          >
                            <FaTrash className="me-2" size={13} />Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
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
            const isOpen = selectedId === user.id_usuario;
            return (
              <div className="col-12 col-sm-6" key={user.id_usuario}>
                <div
                  className="card border-0 shadow-sm h-100"
                  style={{ borderRadius: "15px", overflow: "hidden", cursor: "pointer", border: isOpen ? "2px solid #667eea" : "2px solid transparent", transition: "border 0.15s" }}
                  onClick={() => toggleSelected(user.id_usuario)}
                >
                  {/* Cabecera */}
                  <div
                    className="d-flex align-items-center justify-content-between px-3 py-3"
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
                    <span style={{ color: "rgba(255,255,255,0.85)" }}>
                      {isOpen ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                    </span>
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

                    {/* Acciones expandibles */}
                    {isOpen && (
                      <div className="d-flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid #e9ecef" }}>
                        <button
                          className="btn btn-sm flex-fill"
                          onClick={(e) => { e.stopPropagation(); onEdit(user); }}
                          style={{ background: "rgba(52,152,219,0.1)", color: "#3498db", border: "1px solid rgba(52,152,219,0.3)", borderRadius: "8px", fontWeight: "600" }}
                        >
                          <FaEdit className="me-2" size={13} />Editar
                        </button>
                        <button
                          className="btn btn-sm flex-fill"
                          onClick={(e) => { e.stopPropagation(); onDelete(user.id_usuario); }}
                          style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.3)", borderRadius: "8px", fontWeight: "600" }}
                        >
                          <FaTrash className="me-2" size={13} />Eliminar
                        </button>
                      </div>
                    )}
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
