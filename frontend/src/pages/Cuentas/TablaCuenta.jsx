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
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useAuth } from "../../context/AuthContext";

export default function TablaCuenta({ cuentas, usuarios, onEdit, onDelete }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";
  const getTipoCuentaConfig = (tipo) => {
    const configs = {
      Aportaciones: {
        color: "#3498db",
        bgColor: "rgba(52, 152, 219, 0.1)",
        icon: FaCoins,
      },
      Vivienda: {
        color: "#27ae60",
        bgColor: "rgba(39, 174, 96, 0.1)",
        icon: FaHome,
      },
      Pensiones: {
        color: "#f39c12",
        bgColor: "rgba(243, 156, 18, 0.1)",
        icon: FaWallet,
      },
    };
    return configs[tipo] || configs.Aportaciones;
  };

  if (!cuentas || cuentas.length === 0) {
    return (
      <div
        className="card border-0 shadow-sm"
        style={{ borderRadius: "15px" }}
      >
        <div className="card-body text-center py-5">
          <div
            className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{
              width: "80px",
              height: "80px",
              background: "rgba(52, 152, 219, 0.1)",
            }}
          >
            <FaWallet style={{ fontSize: "36px", color: "#3498db" }} />
          </div>
          <h5 className="text-muted fw-semibold">No hay cuentas registradas</h5>
          <p className="text-muted mb-0">
            Crea una nueva cuenta para comenzar
          </p>
        </div>
      </div>
    );
  }

  const saldoTotal = cuentas.reduce(
    (sum, c) => sum + parseFloat(c.saldo_actual || c.saldo || 0),
    0
  );

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>

      {/* ── VISTA TABLA (md+) ── */}
      <div className="d-none d-md-block">
        {/* Header */}
        <div
          className="text-white px-3 py-3"
          style={{
            background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
            borderRadius: "15px 15px 0 0",
          }}
        >
          <div className="row g-2 align-items-center fw-semibold" style={{ fontSize: "13px" }}>
            <div className="col-auto" style={{ width: "44px" }}>#</div>
            <div className="col">Socio</div>
            <div className="col-2">Tipo</div>
            <div className="col-3 text-center">Saldo Actual</div>
            <div className="col-2 text-center">Estado</div>
            <div className="col-auto text-center" style={{ width: "120px" }}>Acciones</div>
          </div>
        </div>

        {/* Filas */}
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {cuentas.map((cuenta, index) => {
            const usuario = usuarios.find((u) => u.id_usuario === cuenta.id_usuario);
            const config = getTipoCuentaConfig(cuenta.tipo_cuenta);
            const TipoIcon = config.icon;
            const activa = cuenta.estado === "activa";
            const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo || 0);
            const maxSaldo = 10000;
            const porcentaje = Math.min((saldo / maxSaldo) * 100, 100);

            return (
              <div
                key={cuenta.id_cuenta}
                className="border-bottom"
                style={{ transition: "background 0.2s", background: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                <div className="row g-2 align-items-center px-3 py-2">
                  {/* # */}
                  <div className="col-auto" style={{ width: "44px" }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{ width: "30px", height: "30px", background: config.bgColor, color: config.color, fontSize: "13px" }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Socio */}
                  <div className="col" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                        style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "white" }}
                      >
                        <FaUser style={{ fontSize: "15px" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate" style={{ color: "#2c3e50", fontSize: "13px" }}>
                          {usuario?.nombre_completo || "N/A"}
                        </div>
                        <div className="text-muted d-flex align-items-center" style={{ fontSize: "11px" }}>
                          <FaIdCard className="me-1" />{usuario?.dni || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="col-2">
                    <span
                      className="badge d-inline-flex align-items-center px-2 py-1"
                      style={{ background: config.bgColor, color: config.color, fontWeight: "600", fontSize: "12px", border: `2px solid ${config.color}`, borderRadius: "8px" }}
                    >
                      <TipoIcon className="me-1" />{cuenta.tipo_cuenta}
                    </span>
                  </div>

                  {/* Saldo */}
                  <div className="col-3">
                    <div className="d-flex align-items-center justify-content-center gap-2">
                      <div style={{ width: "42px", height: "42px", flexShrink: 0 }}>
                        <CircularProgressbar
                          value={porcentaje}
                          text={`${Math.round(porcentaje)}%`}
                          styles={buildStyles({ textSize: "30px", pathColor: config.color, textColor: config.color, trailColor: "#e9ecef" })}
                        />
                      </div>
                      <div>
                        <div className="fw-bold" style={{ fontSize: "15px", color: config.color }}>
                          L. {saldo.toFixed(2)}
                        </div>
                        <div className="text-muted" style={{ fontSize: "10px" }}>Saldo actual</div>
                      </div>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="col-2 text-center">
                    <span
                      className="badge d-inline-flex align-items-center px-2 py-1"
                      style={{ background: activa ? "rgba(39,174,96,.1)" : "rgba(149,165,166,.1)", color: activa ? "#27ae60" : "#95a5a6", fontWeight: "600", fontSize: "11px", border: `2px solid ${activa ? "#27ae60" : "#95a5a6"}`, borderRadius: "8px" }}
                    >
                      {activa ? <><FaCheckCircle className="me-1" />Activa</> : <><FaTimesCircle className="me-1" />Inactiva</>}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="col-auto text-center" style={{ width: "120px" }}>
                    <div className="d-flex gap-1 justify-content-center">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(cuenta)}
                        style={{ background: "rgba(52,152,219,.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "8px", transition: "all .2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#3498db"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(52,152,219,.1)"; e.currentTarget.style.color = "#3498db"; }}
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                      {esAdmin && (
                        <button
                          className="btn btn-sm"
                          onClick={() => onDelete(cuenta.id_cuenta)}
                          style={{ background: "rgba(231,76,60,.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: "8px", transition: "all .2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#e74c3c"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(231,76,60,.1)"; e.currentTarget.style.color = "#e74c3c"; }}
                          title="Eliminar"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── VISTA TARJETAS (< md) ── */}
      <div className="d-md-none">
        <div
          className="text-white px-3 py-3 fw-bold"
          style={{ background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)", borderRadius: "15px 15px 0 0", fontSize: "15px" }}
        >
          <FaWallet className="me-2" />
          Cuentas ({cuentas.length})
        </div>
        <div className="p-2" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {cuentas.map((cuenta, index) => {
            const usuario = usuarios.find((u) => u.id_usuario === cuenta.id_usuario);
            const config = getTipoCuentaConfig(cuenta.tipo_cuenta);
            const TipoIcon = config.icon;
            const activa = cuenta.estado === "activa";
            const saldo = parseFloat(cuenta.saldo_actual || cuenta.saldo || 0);

            return (
              <div
                key={cuenta.id_cuenta}
                className="card border-0 mb-2 shadow-sm"
                style={{ borderRadius: "12px", borderLeft: `4px solid ${config.color}` }}
              >
                <div className="card-body p-3">
                  {/* Cabecera tarjeta */}
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: "38px", height: "38px", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "white" }}
                      >
                        <FaUser style={{ fontSize: "15px" }} />
                      </div>
                      <div>
                        <div className="fw-semibold" style={{ color: "#2c3e50", fontSize: "14px", lineHeight: 1.2 }}>
                          {usuario?.nombre_completo || "N/A"}
                        </div>
                        <div className="text-muted d-flex align-items-center" style={{ fontSize: "11px" }}>
                          <FaIdCard className="me-1" />{usuario?.dni || "N/A"}
                        </div>
                      </div>
                    </div>
                    <span
                      className="badge d-inline-flex align-items-center px-2 py-1"
                      style={{ background: activa ? "rgba(39,174,96,.1)" : "rgba(149,165,166,.1)", color: activa ? "#27ae60" : "#95a5a6", fontWeight: "600", fontSize: "11px", border: `1.5px solid ${activa ? "#27ae60" : "#95a5a6"}`, borderRadius: "8px" }}
                    >
                      {activa ? <><FaCheckCircle className="me-1" />Activa</> : <><FaTimesCircle className="me-1" />Inactiva</>}
                    </span>
                  </div>

                  {/* Tipo + Saldo */}
                  <div className="d-flex justify-content-between align-items-center">
                    <span
                      className="badge d-inline-flex align-items-center px-2 py-1"
                      style={{ background: config.bgColor, color: config.color, fontWeight: "600", fontSize: "12px", border: `2px solid ${config.color}`, borderRadius: "8px" }}
                    >
                      <TipoIcon className="me-1" />{cuenta.tipo_cuenta}
                    </span>
                    <div className="text-end">
                      <div className="fw-bold" style={{ fontSize: "17px", color: config.color }}>L. {saldo.toFixed(2)}</div>
                      <div className="text-muted" style={{ fontSize: "10px" }}>Saldo actual</div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="d-flex gap-2 mt-2">
                    <button
                      className="btn btn-sm flex-fill"
                      onClick={() => onEdit(cuenta)}
                      style={{ background: "rgba(52,152,219,.1)", color: "#3498db", border: "1px solid #3498db", borderRadius: "8px", fontWeight: "600" }}
                    >
                      <FaEdit className="me-1" /> Editar
                    </button>
                    {esAdmin && (
                      <button
                        className="btn btn-sm flex-fill"
                        onClick={() => onDelete(cuenta.id_cuenta)}
                        style={{ background: "rgba(231,76,60,.1)", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: "8px", fontWeight: "600" }}
                      >
                        <FaTrash className="me-1" /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="card-footer bg-light border-top-0 text-center py-3"
        style={{ borderRadius: "0 0 15px 15px" }}
      >
        <p className="text-muted mb-0 small fw-semibold">
          <FaWallet className="me-2" />
          Total de cuentas: <span className="text-primary fw-bold">{cuentas.length}</span>
          {" | "}
          Saldo total: <span className="text-success fw-bold">L. {saldoTotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
