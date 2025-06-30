import { FaEdit, FaTrash, FaSearch, FaUser } from "react-icons/fa";

export default function TablaUsuarios({
  usuarios,
  onEdit,
  onDelete,
  filtro,
  setFiltro,
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white py-3 border-bottom">
        <h5 className="mb-0 d-flex align-items-center">
          <FaUser className="me-2 text-primary" />
          <span>Gestión de Usuarios</span>
        </h5>
      </div>
      <div className="card-body p-0">
        <div className="p-3 border-bottom">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <FaSearch className="text-muted" />
                </span>
                <input
                  className="form-control form-control-sm border-start-0"
                  type="search"
                  placeholder="Buscar nombre, DNI o correo..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-6 text-md-end">
              <span className="badge bg-light text-dark">
                {usuarios.length} usuario(s) encontrado(s)
              </span>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th width="40">#</th>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Dirección</th>
                <th>Nacimiento</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="text-center" width="120">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-4">
                    <div className="py-3 text-muted">
                      No se encontraron usuarios
                    </div>
                  </td>
                </tr>
              ) : (
                usuarios.map((user, i) => (
                  <tr key={user.id_usuario}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div
                        className="text-truncate"
                        style={{ maxWidth: "150px" }}
                      >
                        {user.nombre_completo}
                      </div>
                    </td>
                    <td>{user.dni}</td>
                    <td>{user.telefono}</td>
                    <td>
                      <div
                        className="text-truncate"
                        style={{ maxWidth: "150px" }}
                      >
                        {user.correo}
                      </div>
                    </td>
                    <td>
                      <div
                        className="text-truncate"
                        style={{ maxWidth: "150px" }}
                      >
                        {user.direccion}
                      </div>
                    </td>
                    <td>{user.fecha_nacimiento?.substring(0, 10)}</td>
                    <td>
                      <span className="badge bg-info bg-opacity-10 text-info">
                        {user.rol}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge rounded-pill ${
                          user.estado === "activo"
                            ? "bg-success bg-opacity-10 text-success"
                            : "bg-secondary bg-opacity-10 text-secondary"
                        }`}
                      >
                        {user.estado}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-icon btn-outline-primary me-1"
                        title="Editar"
                        onClick={() => onEdit(user)}
                      >
                        <FaEdit size={8} />
                      </button>
                      <button
                        className="btn btn-sm btn-icon btn-outline-danger"
                        title="Eliminar"
                        onClick={() => onDelete(user.id_usuario)}
                      >
                        <FaTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
