import { FaEdit, FaTrash } from "react-icons/fa";

export default function TablaCuenta({ cuentas, usuarios, onEdit, onDelete }) {
  return (
    <div
      className="table-container"
      style={{ maxHeight: "500px", overflowY: "auto" }}
    >
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light sticky-top" style={{ top: 0 }}>
          <tr>
            <th
              width="50"
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              #
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              Socio
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              Tipo de Cuenta
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              Saldo
            </th>
            <th
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              Estado
            </th>
            <th
              width="150"
              style={{
                position: "sticky",
                top: 0,
                background: "#f8f9fa",
                zIndex: 10,
              }}
            >
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {cuentas.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-4">
                <div className="py-3 text-muted">
                  No hay cuentas registradas o no se encontraron resultados
                </div>
              </td>
            </tr>
          ) : (
            cuentas.map((c, i) => (
              <tr key={c.id_cuenta}>
                <td className="text-muted">{i + 1}</td>
                <td>
                  {usuarios.find((u) => u.id_usuario === c.id_usuario)
                    ?.nombre_completo || "Desconocido"}
                </td>
                <td>
                  <span className="badge bg-info bg-opacity-10 text-info">
                    {c.tipo_cuenta}
                  </span>
                </td>
                <td className="fw-bold">L. {parseFloat(c.saldo).toFixed(2)}</td>
                <td>
                  <span
                    className={`badge rounded-pill ${
                      c.estado === "activa"
                        ? "bg-success bg-opacity-10 text-success"
                        : "bg-secondary bg-opacity-10 text-secondary"
                    }`}
                  >
                    {c.estado}
                  </span>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-primary d-flex align-items-center"
                      onClick={() => onEdit(c)}
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger d-flex align-items-center"
                      onClick={() => onDelete(c.id_cuenta)}
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
