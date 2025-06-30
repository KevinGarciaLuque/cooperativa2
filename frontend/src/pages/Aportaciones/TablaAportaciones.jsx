import { FaEdit, FaTrash } from "react-icons/fa";

export default function TablaAportaciones({
  aportaciones,
  usuarios,
  onEdit,
  onDelete,
}) {
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead>
          <tr>
            <th>#</th>
            <th>Socio</th>
            <th>Monto</th>
            <th>Fecha</th>
            <th>Descripción</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {aportaciones.map((a, i) => (
            <tr key={a.id_aportacion}>
              <td>{i + 1}</td>
              <td>
                {usuarios.find((u) => u.id_usuario === a.id_usuario)
                  ?.nombre_completo || "?"}
              </td>
              <td className="fw-bold text-success">
                L. {parseFloat(a.monto).toFixed(2)}
              </td>
              <td>
                <span className="badge bg-light text-dark">
                  {a.fecha ? a.fecha.substring(0, 10) : "-"}
                </span>
              </td>
              <td>
                <span className="badge bg-info bg-opacity-10 text-info">
                  {a.descripcion}
                </span>
              </td>
              <td>
                <button
                  className="btn btn-sm btn-outline-primary me-1"
                  onClick={() => onEdit(a)}
                  title="Editar"
                >
                  <FaEdit />
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDelete(a.id_aportacion)}
                  title="Eliminar"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
