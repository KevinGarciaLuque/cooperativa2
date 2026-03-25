import {
  FaEdit,
  FaTrash,
  FaUser,
  FaIdCard,
  FaCheckCircle,
  FaTimesCircle,
  FaCoins,
  FaHome,
  FaWallet,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

const TIPOS = ["Aportaciones", "Vivienda", "Pensiones"];
const TIPO_CONFIG = {
  Aportaciones: { color: "#3498db", bgColor: "rgba(52,152,219,0.1)", icon: FaCoins  },
  Vivienda:     { color: "#27ae60", bgColor: "rgba(39,174,96,0.1)",  icon: FaHome   },
  Pensiones:    { color: "#f39c12", bgColor: "rgba(243,156,18,0.1)", icon: FaWallet },
};

export default function TablaCuenta({ cuentas, usuarios, onEdit, onDelete }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";

  if (!cuentas || cuentas.length === 0) {
    return (
      <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
        <div className="card-body text-center py-5">
          <div className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: "80px", height: "80px", background: "rgba(52,152,219,0.1)" }}>
            <FaWallet style={{ fontSize: "36px", color: "#3498db" }} />
          </div>
          <h5 className="text-muted fw-semibold">No hay cuentas registradas</h5>
          <p className="text-muted mb-0">Crea una nueva cuenta para comenzar</p>
        </div>
      </div>
    );
  }

  // Agrupar cuentas por id_usuario â†’ { [id]: { Aportaciones: cuenta, Vivienda: cuenta, ... } }
  const grupos = {};
  cuentas.forEach((cuenta) => {
    const uid = cuenta.id_usuario;
    if (!grupos[uid]) grupos[uid] = {};
    grupos[uid][cuenta.tipo_cuenta] = cuenta;
  });
  const filas = Object.entries(grupos);

  const saldoTotal = cuentas.reduce((s, c) => s + parseFloat(c.saldo_actual || c.saldo || 0), 0);

  // Nombre desde el JOIN del backend o fallback al array de usuarios
  const getNombre = (id_usuario, cuentasPorTipo) => {
    const primera = Object.values(cuentasPorTipo)[0];
    if (primera?.nombre_completo) return primera.nombre_completo;
    return usuarios.find((u) => u.id_usuario === parseInt(id_usuario))?.nombre_completo || "N/A";
  };
  const getDni = (id_usuario, cuentasPorTipo) => {
    const primera = Object.values(cuentasPorTipo)[0];
    if (primera?.dni) return primera.dni;
    return usuarios.find((u) => u.id_usuario === parseInt(id_usuario))?.dni || "N/A";
  };

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>

      {/* â”€â”€ TABLA DESKTOP (md+) â”€â”€ */}
      <div className="d-none d-md-block">
        {/* Header */}
        <div className="text-white px-3 py-3"
          style={{ background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)", borderRadius: "15px 15px 0 0" }}>
          <div className="d-flex align-items-center fw-semibold" style={{ fontSize: "13px" }}>
            <div style={{ width: "44px", flexShrink: 0 }}>#</div>
            <div style={{ flex: "0 0 26%", minWidth: 0 }}>Socio</div>
            {TIPOS.map((tipo) => {
              const HeaderIcon = TIPO_CONFIG[tipo].icon;
              return (
                <div key={tipo} className="text-center d-flex align-items-center justify-content-center gap-1" style={{ flex: 1 }}>
                  <HeaderIcon style={{ fontSize: "13px" }} />
                  {tipo}
                </div>
              );
            })}
          </div>
        </div>

        {/* Filas */}
        <div style={{ maxHeight: "520px", overflowY: "auto" }}>
          {filas.map(([id_usuario, cuentasPorTipo], index) => {
            const nombre = getNombre(id_usuario, cuentasPorTipo);
            const dni    = getDni(id_usuario, cuentasPorTipo);
            return (
              <div key={id_usuario} className="border-bottom"
                style={{ background: "white", transition: "background .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                <div className="d-flex align-items-center px-3 py-3">
                  {/* # */}
                  <div style={{ width: "44px", flexShrink: 0 }}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{ width: "30px", height: "30px", background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: "12px" }}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Socio */}
                  <div style={{ flex: "0 0 26%", minWidth: 0 }}>
                    <div className="d-flex align-items-center">
                      <div className="rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                        style={{ width: "36px", height: "36px", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "white" }}>
                        <FaUser style={{ fontSize: "14px" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: "13px" }}>{nombre}</div>
                        <div className="text-muted d-flex align-items-center" style={{ fontSize: "11px" }}>
                          <FaIdCard className="me-1" />{dni}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columnas por tipo */}
                  {TIPOS.map((tipo) => {
                    const cuenta = cuentasPorTipo[tipo];
                    const cfg    = TIPO_CONFIG[tipo];
                    if (!cuenta) {
                      return (
                        <div key={tipo} className="text-center" style={{ flex: 1 }}>
                          <span className="text-muted">N/A</span>
                        </div>
                      );
                    }
                    const saldo  = parseFloat(cuenta.saldo_actual || cuenta.saldo || 0);
                    const activa = cuenta.estado === "activa";
                    return (
                      <div key={tipo} className="text-center" style={{ flex: 1 }}>
                        <div className="fw-bold" style={{ color: cfg.color, fontSize: "14px" }}>
                          L. {saldo.toFixed(2)}
                        </div>
                        <div className="mb-1">
                          <span className="badge px-2 py-1"
                            style={{ background: activa ? "rgba(39,174,96,.1)" : "rgba(149,165,166,.1)", color: activa ? "#27ae60" : "#95a5a6", fontSize: "10px", border: `1px solid ${activa ? "#27ae60" : "#95a5a6"}`, borderRadius: "6px" }}>
                            {activa ? <><FaCheckCircle className="me-1" />Activa</> : <><FaTimesCircle className="me-1" />Inactiva</>}
                          </span>
                        </div>
                        <div className="d-flex gap-1 justify-content-center">
                          <button className="btn btn-sm" onClick={() => onEdit(cuenta)}
                            style={{ background: "rgba(52,152,219,.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "6px", padding: "2px 8px" }}
                            title="Editar">
                            <FaEdit style={{ fontSize: "11px" }} />
                          </button>
                          {esAdmin && (
                            <button className="btn btn-sm" onClick={() => onDelete(cuenta.id_cuenta)}
                              style={{ background: "rgba(231,76,60,.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: "6px", padding: "2px 8px" }}
                              title="Eliminar">
                              <FaTrash style={{ fontSize: "11px" }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* â”€â”€ TARJETAS MOBILE (< md) â”€â”€ */}
      <div className="d-md-none">
        <div className="text-white px-3 py-3 fw-bold"
          style={{ background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)", borderRadius: "15px 15px 0 0", fontSize: "15px" }}>
          <FaWallet className="me-2" />
          Cuentas &mdash; {filas.length} socios
        </div>
        <div className="p-2" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {filas.map(([id_usuario, cuentasPorTipo], index) => {
            const nombre = getNombre(id_usuario, cuentasPorTipo);
            const dni    = getDni(id_usuario, cuentasPorTipo);
            return (
              <div key={id_usuario} className="card border-0 mb-3 shadow-sm" style={{ borderRadius: "12px" }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center mb-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                      style={{ width: "40px", height: "40px", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "white" }}>
                      <FaUser style={{ fontSize: "16px" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: "14px" }}>{nombre}</div>
                      <div className="text-muted" style={{ fontSize: "11px" }}><FaIdCard className="me-1" />{dni}</div>
                    </div>
                    <div className="ms-auto rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                      style={{ width: "28px", height: "28px", background: "rgba(52,152,219,0.1)", color: "#3498db", fontSize: "12px" }}>
                      {index + 1}
                    </div>
                  </div>
                  {TIPOS.map((tipo) => {
                    const cuenta = cuentasPorTipo[tipo];
                    const cfg    = TIPO_CONFIG[tipo];
                    const TipoIcon = cfg.icon;
                    if (!cuenta) return null;
                    const saldo  = parseFloat(cuenta.saldo_actual || cuenta.saldo || 0);
                    const activa = cuenta.estado === "activa";
                    return (
                      <div key={tipo} className="d-flex align-items-center justify-content-between mb-2 p-2 rounded"
                        style={{ background: cfg.bgColor, border: `1px solid ${cfg.color}30` }}>
                        <div className="d-flex align-items-center gap-2">
                          <TipoIcon style={{ color: cfg.color, fontSize: "14px" }} />
                          <div>
                            <div style={{ color: cfg.color, fontSize: "11px", fontWeight: 600 }}>{tipo}</div>
                            <div className="fw-bold" style={{ fontSize: "14px", color: cfg.color }}>L. {saldo.toFixed(2)}</div>
                          </div>
                          <span className="badge px-1"
                            style={{ background: activa ? "rgba(39,174,96,.15)" : "rgba(149,165,166,.15)", color: activa ? "#27ae60" : "#95a5a6", fontSize: "10px", borderRadius: "6px" }}>
                            {activa ? "Activa" : "Inactiva"}
                          </span>
                        </div>
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm" onClick={() => onEdit(cuenta)}
                            style={{ background: "rgba(52,152,219,.15)", color: "#3498db", border: "1px solid #3498db", borderRadius: "6px", padding: "3px 8px" }}>
                            <FaEdit style={{ fontSize: "11px" }} />
                          </button>
                          {esAdmin && (
                            <button className="btn btn-sm" onClick={() => onDelete(cuenta.id_cuenta)}
                              style={{ background: "rgba(231,76,60,.15)", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: "6px", padding: "3px 8px" }}>
                              <FaTrash style={{ fontSize: "11px" }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="card-footer bg-light border-top-0 text-center py-3" style={{ borderRadius: "0 0 15px 15px" }}>
        <p className="text-muted mb-0 small fw-semibold">
          <FaWallet className="me-2" />
          {filas.length} socios &middot; {cuentas.length} cuentas &middot; Saldo total:{" "}
          <span className="text-success fw-bold">L. {saldoTotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
