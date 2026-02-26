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
  FaEye,
} from "react-icons/fa";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function TablaCuenta({ cuentas, usuarios, onEdit, onDelete }) {
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

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "15px" }}>
      {/* Header de la tabla */}
      <div
        className="text-white p-3"
        style={{
          background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-3">Socio</div>
          <div className="col-2">Tipo de Cuenta</div>
          <div className="col-2 text-center">Saldo Actual</div>
          <div className="col-1 text-center">Estado</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body de la tabla */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {cuentas.map((cuenta, index) => {
            const usuario = usuarios.find(
              (u) => u.id_usuario === cuenta.id_usuario
            );
            const config = getTipoCuentaConfig(cuenta.tipo_cuenta);
            const TipoIcon = config.icon;
            const activa = cuenta.estado === "activa";

            // Calcular porcentaje para el indicador visual (dummy, basado en saldo/10000)
            const maxSaldo = 10000;
            const porcentaje = Math.min(
              (parseFloat(cuenta.saldo_actual || cuenta.saldo || 0) / maxSaldo) *
                100,
              100
            );

            return (
              <div
                key={cuenta.id_cuenta}
                className="border-bottom"
                style={{
                  transition: "all 0.3s ease",
                  background: "white",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8f9fa";
                  e.currentTarget.style.transform = "scale(1.01)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="row g-2 align-items-center p-3">
                  {/* Número */}
                  <div className="col-auto" style={{ width: "50px" }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: "32px",
                        height: "32px",
                        background: config.bgColor,
                        color: config.color,
                        fontSize: "14px",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Socio */}
                  <div className="col-3">
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: "40px",
                          height: "40px",
                          background: "linear-gradient(135deg, #667eea, #764ba2)",
                          color: "white",
                          flexShrink: 0,
                        }}
                      >
                        <FaUser style={{ fontSize: "18px" }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="fw-semibold text-truncate"
                          style={{ color: "#2c3e50", fontSize: "14px" }}
                        >
                          {usuario?.nombre_completo || "N/A"}
                        </div>
                        <div
                          className="text-muted small d-flex align-items-center"
                          style={{ fontSize: "12px" }}
                        >
                          <FaIdCard className="me-1" />
                          {usuario?.dni || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tipo de Cuenta */}
                  <div className="col-2">
                    <span
                      className="badge d-inline-flex align-items-center px-3 py-2"
                      style={{
                        background: config.bgColor,
                        color: config.color,
                        fontWeight: "600",
                        fontSize: "13px",
                        border: `2px solid ${config.color}`,
                        borderRadius: "10px",
                      }}
                    >
                      <TipoIcon className="me-2" />
                      {cuenta.tipo_cuenta}
                    </span>
                  </div>

                  {/* Saldo Actual con Indicador */}
                  <div className="col-2">
                    <div className="d-flex align-items-center justify-content-center">
                      <div style={{ width: "50px", height: "50px", marginRight: "12px" }}>
                        <CircularProgressbar
                          value={porcentaje}
                          text={`${Math.round(porcentaje)}%`}
                          styles={buildStyles({
                            textSize: "28px",
                            pathColor: config.color,
                            textColor: config.color,
                            trailColor: "#e9ecef",
                            pathTransitionDuration: 0.5,
                          })}
                        />
                      </div>
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "18px", color: config.color }}
                        >
                          L. {parseFloat(cuenta.saldo_actual || cuenta.saldo || 0).toFixed(2)}
                        </div>
                        <div className="text-muted small" style={{ fontSize: "11px" }}>
                          Saldo actual
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="col-1 text-center">
                    <span
                      className="badge d-inline-flex align-items-center px-3 py-2"
                      style={{
                        background: activa
                          ? "rgba(39, 174, 96, 0.1)"
                          : "rgba(149, 165, 166, 0.1)",
                        color: activa ? "#27ae60" : "#95a5a6",
                        fontWeight: "600",
                        fontSize: "12px",
                        border: `2px solid ${activa ? "#27ae60" : "#95a5a6"}`,
                        borderRadius: "8px",
                      }}
                    >
                      {activa ? (
                        <>
                          <FaCheckCircle className="me-1" />
                          Activa
                        </>
                      ) : (
                        <>
                          <FaTimesCircle className="me-1" />
                          Inactiva
                        </>
                      )}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="col text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(cuenta)}
                        style={{
                          background: "rgba(52, 152, 219, 0.1)",
                          color: "#3498db",
                          border: "1px solid #3498db",
                          borderRadius: "8px 0 0 8px",
                          fontWeight: "600",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#3498db";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(52, 152, 219, 0.1)";
                          e.currentTarget.style.color = "#3498db";
                        }}
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => onDelete(cuenta.id_cuenta)}
                        style={{
                          background: "rgba(231, 76, 60, 0.1)",
                          color: "#e74c3c",
                          border: "1px solid #e74c3c",
                          borderLeft: "none",
                          borderRadius: "0 8px 8px 0",
                          fontWeight: "600",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#e74c3c";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(231, 76, 60, 0.1)";
                          e.currentTarget.style.color = "#e74c3c";
                        }}
                        title="Eliminar"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer con resumen */}
      <div
        className="card-footer bg-light border-top-0 text-center py-3"
        style={{ borderRadius: "0 0 15px 15px" }}
      >
        <p className="text-muted mb-0 small fw-semibold">
          <FaWallet className="me-2" />
          Total de cuentas: <span className="text-primary fw-bold">{cuentas.length}</span>
          {" | "}
          Saldo total: <span className="text-success fw-bold">
            L.{" "}
            {cuentas
              .reduce(
                (sum, c) => sum + parseFloat(c.saldo_actual || c.saldo || 0),
                0
              )
              .toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}
