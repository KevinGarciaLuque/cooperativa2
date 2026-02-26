import {
  FaEdit,
  FaTrash,
  FaUser,
  FaIdCard,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaFileAlt,
  FaCheckCircle,
} from "react-icons/fa";

export default function TablaAportaciones({
  aportaciones,
  usuarios,
  onEdit,
  onDelete,
}) {
  if (!aportaciones || aportaciones.length === 0) {
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
              background: "rgba(39, 174, 96, 0.1)",
            }}
          >
            <FaMoneyBillWave style={{ fontSize: "36px", color: "#27ae60" }} />
          </div>
          <h5 className="text-muted fw-semibold">
            No hay aportaciones registradas
          </h5>
          <p className="text-muted mb-0">
            Registra una nueva aportación para comenzar
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
          background: "linear-gradient(135deg, #27ae60 0%, #229954 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <div className="row g-2 align-items-center fw-semibold">
          <div className="col-auto" style={{ width: "50px" }}>
            #
          </div>
          <div className="col-3">Socio</div>
          <div className="col-2 text-center">Monto</div>
          <div className="col-2 text-center">Fecha</div>
          <div className="col-3">Descripción</div>
          <div className="col text-center">Acciones</div>
        </div>
      </div>

      {/* Body de la tabla */}
      <div className="card-body p-0">
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {aportaciones.map((aportacion, index) => {
            const usuario = usuarios.find(
              (u) => u.id_usuario === aportacion.id_usuario
            );
            const monto = parseFloat(aportacion.monto || 0);
            const fecha = aportacion.fecha
              ? aportacion.fecha.substring(0, 10)
              : "-";

            return (
              <div
                key={aportacion.id_aportacion}
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
                        background: "rgba(39, 174, 96, 0.1)",
                        color: "#27ae60",
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
                          background:
                            "linear-gradient(135deg, #27ae60, #229954)",
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

                  {/* Monto */}
                  <div className="col-2 text-center">
                    <div className="d-flex align-items-center justify-content-center">
                      <FaMoneyBillWave
                        className="me-2"
                        style={{ color: "#27ae60", fontSize: "20px" }}
                      />
                      <div>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "18px", color: "#27ae60" }}
                        >
                          L. {monto.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="col-2 text-center">
                    <div
                      className="badge px-3 py-2 d-inline-flex align-items-center"
                      style={{
                        background: "rgba(52, 152, 219, 0.1)",
                        color: "#3498db",
                        fontWeight: "600",
                        fontSize: "13px",
                        border: "2px solid #3498db",
                        borderRadius: "10px",
                      }}
                    >
                      <FaCalendarAlt className="me-2" />
                      {fecha}
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="col-3">
                    <div
                      className="d-flex align-items-center"
                      style={{
                        background: "rgba(155, 89, 182, 0.1)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(155, 89, 182, 0.2)",
                      }}
                    >
                      <FaFileAlt
                        className="me-2"
                        style={{ color: "#9b59b6", fontSize: "14px" }}
                      />
                      <span
                        className="text-truncate"
                        style={{
                          color: "#9b59b6",
                          fontSize: "13px",
                          fontWeight: "500",
                        }}
                        title={aportacion.descripcion || "Sin descripción"}
                      >
                        {aportacion.descripcion || "Sin descripción"}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="col text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm"
                        onClick={() => onEdit(aportacion)}
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
                        onClick={() => onDelete(aportacion.id_aportacion)}
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
          <FaCheckCircle className="me-2 text-success" />
          Total de aportaciones:{" "}
          <span className="text-primary fw-bold">{aportaciones.length}</span>
          {" | "}
          Monto total:{" "}
          <span className="text-success fw-bold">
            L.{" "}
            {aportaciones
              .reduce((sum, a) => sum + parseFloat(a.monto || 0), 0)
              .toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}
