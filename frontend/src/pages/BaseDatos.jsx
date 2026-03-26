import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import {
  FaDatabase,
  FaDownload,
  FaUpload,
  FaTable,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSyncAlt,
  FaClock,
  FaToggleOn,
  FaToggleOff,
  FaTrash,
  FaCalendarAlt,
  FaPlay,
  FaSave,
  FaHistory,
} from "react-icons/fa";

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function BaseDatos() {
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();

  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);
  const fileInputRef = useRef(null);

  // ── Backup programado ─────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    activo: false, frecuencia: "diario", hora: "02:00",
    dia_semana: 1, max_backups: 10, ultimo_backup: null,
  });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [ejecutandoAuto, setEjecutandoAuto] = useState(false);
  const [eliminando, setEliminando] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // ── Cargar info de la BD ─────────────────────────────────────────────────
  const cargarInfo = async () => {
    try {
      setLoadingInfo(true);
      const res = await axios.get(`${API_URL}/basedatos/info`, { headers });
      setInfo(res.data);
    } catch {
      mostrarAlerta("No se pudo obtener la información de la base de datos.", "error");
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    cargarInfo();
    cargarConfig();
    cargarBackups();
    // eslint-disable-next-line
  }, []);

  // ── Descargar backup ─────────────────────────────────────────────────────
  const descargarBackup = async () => {
    try {
      setDescargando(true);
      const res = await axios.get(`${API_URL}/basedatos/backup`, {
        headers,
        responseType: "blob",
      });

      // Extraer nombre del header Content-Disposition
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `backup_cooperativa_${fechaHoraActual()}.sql`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      mostrarAlerta(`Backup descargado: ${filename}`, "success");
    } catch {
      mostrarAlerta("Error al generar el backup.", "error");
    } finally {
      setDescargando(false);
    }
  };

  // ── Importar SQL ─────────────────────────────────────────────────────────
  const handleImportar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".sql")) {
      mostrarAlerta("Solo se permiten archivos .sql", "warning");
      fileInputRef.current.value = "";
      return;
    }

    const confirmar = window.confirm(
      `⚠️ ADVERTENCIA\n\nEsto ejecutará todas las sentencias del archivo "${file.name}" sobre la base de datos actual.\n\nEsta acción puede SOBRESCRIBIR o ELIMINAR datos existentes.\n\n¿Está seguro de continuar?`
    );

    if (!confirmar) {
      fileInputRef.current.value = "";
      return;
    }

    try {
      setImportando(true);
      setResultadoImport(null);

      const formData = new FormData();
      formData.append("archivo", file);

      const res = await axios.post(`${API_URL}/basedatos/importar`, formData, {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
      });

      setResultadoImport(res.data);
      mostrarAlerta(res.data.message, res.data.errores?.length > 0 ? "warning" : "success");
      cargarInfo(); // refrescar info
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al importar.", "error");
    } finally {
      setImportando(false);
      fileInputRef.current.value = "";
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fechaHoraActual = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const formatearFechaISO = (iso) => {
    if (!iso) return "Nunca";
    try { return new Date(iso).toLocaleString("es-HN"); } catch { return iso; }
  };

  const describePrograma = (cfg) => {
    if (!cfg.activo) return "Desactivado";
    switch (cfg.frecuencia) {
      case "hora":    return "Cada hora";
      case "diario":  return `Todos los días a las ${cfg.hora}`;
      case "semanal": return `Cada ${DIAS_SEMANA[cfg.dia_semana ?? 1]} a las ${cfg.hora}`;
      default: return "";
    }
  };

  // ── Config backup programado ──────────────────────────────────────────────
  const cargarConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/basedatos/config-backup`, { headers });
      setConfig(res.data.config);
    } catch (err) { /* silencioso */ }
  };

  const guardarConfigBackup = async () => {
    try {
      setGuardandoConfig(true);
      const res = await axios.post(`${API_URL}/basedatos/config-backup`, config, { headers });
      setConfig(res.data.config);
      mostrarAlerta("Configuración de backup guardada.", "success");
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al guardar configuración.", "error");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const ejecutarAhora = async () => {
    try {
      setEjecutandoAuto(true);
      const res = await axios.post(`${API_URL}/basedatos/ejecutar-backup`, {}, { headers });
      mostrarAlerta(res.data.message, "success");
      cargarBackups();
      cargarConfig();
    } catch (err) {
      mostrarAlerta(err.response?.data?.message || "Error al generar backup.", "error");
    } finally {
      setEjecutandoAuto(false);
    }
  };

  // ── Backups guardados ─────────────────────────────────────────────────────
  const cargarBackups = async () => {
    try {
      setLoadingBackups(true);
      const res = await axios.get(`${API_URL}/basedatos/backups-guardados`, { headers });
      setBackups(res.data.backups || []);
    } catch (err) { /* silencioso */ } finally {
      setLoadingBackups(false);
    }
  };

  const descargarBackupGuardado = async (nombre) => {
    try {
      const res = await axios.get(
        `${API_URL}/basedatos/backups-guardados/${encodeURIComponent(nombre)}`,
        { headers, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      mostrarAlerta("No se pudo descargar el backup.", "error");
    }
  };

  const eliminarBackupGuardado = async (nombre) => {
    if (!window.confirm(`¿Eliminar el backup "${nombre}"?`)) return;
    try {
      setEliminando(nombre);
      await axios.delete(
        `${API_URL}/basedatos/backups-guardados/${encodeURIComponent(nombre)}`,
        { headers }
      );
      mostrarAlerta("Backup eliminado.", "success");
      setBackups((prev) => prev.filter((b) => b.nombre !== nombre));
    } catch (err) {
      mostrarAlerta("Error al eliminar el backup.", "error");
    } finally {
      setEliminando(null);
    }
  };

  const totalRegistros = info?.tablas?.reduce((acc, t) => acc + Number(t.registros), 0) ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* ── Encabezado ── */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: "linear-gradient(135deg,#1a2035,#2d3f6e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#a8cd3a",
            flexShrink: 0,
          }}
        >
          <FaDatabase />
        </div>
        <div>
          <h4 className="mb-0 fw-bold">Base de Datos</h4>
          <small className="text-muted">Backup, exportación, importación y backups programados</small>
        </div>
      </div>

      {/* ── Cards de acciones ── */}
      <div className="row g-3 mb-4">
        {/* Backup / Exportar */}
        <div className="col-12 col-md-6">
          <div
            className="card border-0 h-100"
            style={{ background: "linear-gradient(135deg,#0f5132,#198754)", color: "#fff", borderRadius: 16 }}
          >
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-2">
                <FaDownload size={22} />
                <h5 className="mb-0 fw-bold">Exportar / Backup</h5>
              </div>
              <p className="mb-0" style={{ opacity: 0.85 }}>
                Descarga un archivo <strong>.sql</strong> completo con la
                estructura y todos los datos actuales. El nombre incluye fecha
                y hora exacta automáticamente.
              </p>
              <button
                className="btn btn-light fw-semibold mt-auto"
                style={{ color: "#0f5132", borderRadius: 10 }}
                onClick={descargarBackup}
                disabled={descargando}
              >
                {descargando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Generando backup...
                  </>
                ) : (
                  <>
                    <FaDownload className="me-2" />
                    Descargar Backup Ahora
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Importar */}
        <div className="col-12 col-md-6">
          <div
            className="card border-0 h-100"
            style={{ background: "linear-gradient(135deg,#6c0e23,#c82333)", color: "#fff", borderRadius: 16 }}
          >
            <div className="card-body d-flex flex-column gap-3 p-4">
              <div className="d-flex align-items-center gap-2">
                <FaUpload size={22} />
                <h5 className="mb-0 fw-bold">Importar SQL</h5>
              </div>
              <p className="mb-0" style={{ opacity: 0.85 }}>
                Carga un archivo <strong>.sql</strong> para restaurar o migrar
                datos. Se pedirá confirmación antes de ejecutar.{" "}
                <strong>Máx. 50 MB.</strong>
              </p>
              <button
                className="btn btn-light fw-semibold mt-auto"
                style={{ color: "#6c0e23", borderRadius: 10 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={importando}
              >
                {importando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Importando...
                  </>
                ) : (
                  <>
                    <FaUpload className="me-2" />
                    Seleccionar Archivo .sql
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql"
                className="d-none"
                onChange={handleImportar}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Resultado de importación ── */}
      {resultadoImport && (
        <div
          className={`alert ${resultadoImport.errores?.length > 0 ? "alert-warning" : "alert-success"} mb-4`}
          style={{ borderRadius: 12 }}
        >
          <div className="d-flex align-items-center gap-2 mb-2 fw-bold">
            {resultadoImport.errores?.length > 0 ? (
              <FaExclamationTriangle />
            ) : (
              <FaCheckCircle />
            )}
            {resultadoImport.message}
          </div>
          {resultadoImport.errores?.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer" }}>
                Ver {resultadoImport.errores.length} error(es)
              </summary>
              <ul className="mt-2 mb-0 small">
                {resultadoImport.errores.map((e, i) => (
                  <li key={i}>
                    <code>{e.sentencia}</code> — {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ── Backup Programado ── */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <FaClock style={{ color: "#a8cd3a" }} />
              Backup Programado Automático
            </h6>
            {/* Toggle activo/inactivo */}
            <div
              className="d-flex align-items-center gap-2"
              style={{ cursor: "pointer" }}
              onClick={() => setConfig((c) => ({ ...c, activo: !c.activo }))}
            >
              {config.activo
                ? <FaToggleOn size={30} style={{ color: "#198754" }} />
                : <FaToggleOff size={30} style={{ color: "#aaa" }} />
              }
              <span className={`fw-semibold ${config.activo ? "text-success" : "text-muted"}`} style={{ fontSize: "0.9rem" }}>
                {config.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>

          {/* Programa actual */}
          <div
            className="alert alert-light py-2 px-3 mb-3 d-flex align-items-center gap-2"
            style={{ borderRadius: 10, fontSize: "0.87rem" }}
          >
            <FaCalendarAlt style={{ color: "#6c757d" }} />
            <span>
              <strong>Programa actual:</strong> {describePrograma(config)}
              {config.ultimo_backup && (
                <> &nbsp;·&nbsp; <strong>Último backup:</strong> {formatearFechaISO(config.ultimo_backup)}</>
              )}
            </span>
          </div>

          <div className="row g-3">
            {/* Frecuencia */}
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.82rem" }}>Frecuencia</label>
              <select
                className="form-select form-select-sm"
                value={config.frecuencia}
                onChange={(e) => setConfig((c) => ({ ...c, frecuencia: e.target.value }))}
              >
                <option value="hora">Cada hora</option>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>

            {/* Hora (ocultar si frecuencia = hora) */}
            {config.frecuencia !== "hora" && (
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.82rem" }}>Hora del día</label>
                <input
                  type="time"
                  className="form-control form-control-sm"
                  value={config.hora}
                  onChange={(e) => setConfig((c) => ({ ...c, hora: e.target.value }))}
                />
              </div>
            )}

            {/* Día de semana (solo si semanal) */}
            {config.frecuencia === "semanal" && (
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label fw-semibold" style={{ fontSize: "0.82rem" }}>Día de la semana</label>
                <select
                  className="form-select form-select-sm"
                  value={config.dia_semana}
                  onChange={(e) => setConfig((c) => ({ ...c, dia_semana: Number(e.target.value) }))}
                >
                  {DIAS_SEMANA.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Máx. backups */}
            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.82rem" }}>Máx. backups guardados</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={1} max={100}
                value={config.max_backups}
                onChange={(e) => setConfig((c) => ({ ...c, max_backups: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Botones */}
          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button
              className="btn btn-primary btn-sm fw-semibold"
              style={{ borderRadius: 8 }}
              onClick={guardarConfigBackup}
              disabled={guardandoConfig}
            >
              {guardandoConfig
                ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
                : <><FaSave className="me-2" />Guardar configuración</>
              }
            </button>
            <button
              className="btn btn-outline-secondary btn-sm fw-semibold"
              style={{ borderRadius: 8 }}
              onClick={ejecutarAhora}
              disabled={ejecutandoAuto}
            >
              {ejecutandoAuto
                ? <><span className="spinner-border spinner-border-sm me-2" />Ejecutando...</>
                : <><FaPlay className="me-2" />Ejecutar backup ahora</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Backups Guardados ── */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <FaHistory style={{ color: "#a8cd3a" }} />
              Backups Guardados en el Servidor
            </h6>
            <button
              className="btn btn-outline-secondary btn-sm"
              style={{ borderRadius: 8 }}
              onClick={cargarBackups}
              disabled={loadingBackups}
            >
              <FaSyncAlt className={loadingBackups ? "fa-spin" : ""} />
            </button>
          </div>

          {loadingBackups ? (
            <div className="text-center py-3">
              <span className="spinner-border spinner-border-sm text-secondary" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <FaDatabase size={32} style={{ opacity: 0.2 }} />
              <p className="mt-2 mb-1" style={{ fontSize: "0.9rem" }}>No hay backups guardados en el servidor.</p>
              <p className="mb-0" style={{ fontSize: "0.8rem" }}>
                Usa <strong>"Ejecutar backup ahora"</strong> o activa el backup programado.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: "#f4f6fb" }}>
                  <tr>
                    <th style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}>
                      <FaCalendarAlt className="me-1" /> Fecha y hora
                    </th>
                    <th style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}>
                      Archivo
                    </th>
                    <th className="text-end" style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}>
                      Tamaño
                    </th>
                    <th className="text-end" style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.nombre}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{b.fecha}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.78rem", color: "#6c757d" }}>{b.nombre}</code>
                      </td>
                      <td className="text-end">
                        <span className="badge bg-light text-secondary" style={{ fontSize: "0.78rem", padding: "4px 8px" }}>
                          {b.tamano_kb} KB
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-success"
                            style={{ borderRadius: 7 }}
                            onClick={() => descargarBackupGuardado(b.nombre)}
                            title="Descargar"
                          >
                            <FaDownload />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ borderRadius: 7 }}
                            onClick={() => eliminarBackupGuardado(b.nombre)}
                            disabled={eliminando === b.nombre}
                            title="Eliminar"
                          >
                            {eliminando === b.nombre
                              ? <span className="spinner-border spinner-border-sm" />
                              : <FaTrash />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Info de la BD ── */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <FaInfoCircle style={{ color: "#a8cd3a" }} />
              Información de la Base de Datos
            </h6>
            <button
              className="btn btn-outline-secondary btn-sm"
              style={{ borderRadius: 8 }}
              onClick={cargarInfo}
              disabled={loadingInfo}
            >
              <FaSyncAlt className={loadingInfo ? "fa-spin" : ""} />
            </button>
          </div>

          {loadingInfo ? (
            <div className="text-center py-4">
              <span className="spinner-border spinner-border-sm text-secondary" />
              <p className="text-muted mt-2 mb-0">Cargando información...</p>
            </div>
          ) : info ? (
            <>
              {/* Resumen superior */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-4">
                  <div className="p-3 rounded-3 text-center" style={{ background: "#f8f9fa" }}>
                    <div className="fw-bold fs-4" style={{ color: "#1a2035" }}>
                      {info.tablas?.length ?? 0}
                    </div>
                    <small className="text-muted">Tablas</small>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="p-3 rounded-3 text-center" style={{ background: "#f8f9fa" }}>
                    <div className="fw-bold fs-4" style={{ color: "#1a2035" }}>
                      {totalRegistros.toLocaleString("es-HN")}
                    </div>
                    <small className="text-muted">Registros totales</small>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 rounded-3 text-center" style={{ background: "#f8f9fa" }}>
                    <div className="fw-bold fs-4" style={{ color: "#1a2035" }}>
                      {info.tamano_mb ?? "—"} MB
                    </div>
                    <small className="text-muted">Tamaño estimado</small>
                  </div>
                </div>
              </div>

              {/* Tabla de tablas */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead style={{ background: "#f4f6fb" }}>
                    <tr>
                      <th style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}>
                        <FaTable className="me-1" /> Tabla
                      </th>
                      <th
                        className="text-end"
                        style={{ fontWeight: 600, color: "#6c757d", fontSize: "0.8rem", textTransform: "uppercase" }}
                      >
                        Registros
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.tablas?.map((t) => (
                      <tr key={t.tabla}>
                        <td>
                          <code style={{ fontSize: "0.85rem" }}>{t.tabla}</code>
                        </td>
                        <td className="text-end">
                          <span
                            className="badge"
                            style={{
                              background: Number(t.registros) > 0 ? "#e8f5c8" : "#f0f0f0",
                              color: Number(t.registros) > 0 ? "#5a7a00" : "#999",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              padding: "5px 10px",
                              borderRadius: 20,
                            }}
                          >
                            {Number(t.registros).toLocaleString("es-HN")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-muted text-center py-3">Sin datos</p>
          )}
        </div>
      </div>
    </div>
  );
}
