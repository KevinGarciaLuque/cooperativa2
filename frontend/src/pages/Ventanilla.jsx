import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
import DetallePrestamoVentanilla from "./DetallePrestamoVentanilla";
import EstadoCuentaSocio from "./EstadoCuentaSocio";
import RecibosSocioModal from "../components/RecibosSocioModal";
import CartasAprobacionSocio from "../components/CartasAprobacionSocio";
import ExpedienteSocio from "../components/ExpedienteSocio";
import ConsolidarPrestamos from "../components/ConsolidarPrestamos";
import ReciboModal from "../components/ReciboModal";
import { Paginacion, EmptyState, TablaSkeleton } from "../ui/Componentes";
import SolicitudesSocioFicha from "../components/SolicitudesSocioFicha";
import {
  FaSearch,
  FaUserCircle,
  FaMoneyCheckAlt,
  FaHandHoldingUsd,
  FaPiggyBank,
  FaUniversity,
  FaHistory,
  FaFileInvoiceDollar,
  FaExclamationTriangle,
  FaTimes,
  FaIdCard,
  FaFileSignature,
  FaUserShield,
  FaFolderOpen,
} from "react-icons/fa";

const ACCENT = "#a8cd3a";
const AZUL = "#1a2035";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ESTADOS_VIGENTES = ["activo", "mora"];
const esVigente = (p) => ESTADOS_VIGENTES.includes((p.estado || "").toLowerCase());

export default function Ventanilla() {
  const { token, user } = useAuth();
  const esSuperAdmin = user?.rol === "Super Administrador";
  const { mostrarAlerta } = useAlerta();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [busqueda, setBusqueda] = useState("");
  // Lista de socios (paginada desde el servidor)
  const [lista, setLista] = useState([]);
  const [totalLista, setTotalLista] = useState(0);
  const [paginaLista, setPaginaLista] = useState(1);
  const [filtroLista, setFiltroLista] = useState("");
  const [cargandoLista, setCargandoLista] = useState(true);
  const [socio, setSocio] = useState(null);
  const [ficha, setFicha] = useState(null); // { prestamos, cuentas, aportaciones, proximos }
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [detalle, setDetalle] = useState(null); // id del préstamo cuyo detalle se está viendo
  const [verEstadoCuenta, setVerEstadoCuenta] = useState(false);
  const [verRecibos, setVerRecibos] = useState(false);
  const [verCartas, setVerCartas] = useState(false);
  const [pestana, setPestana] = useState("expediente");
  const [consolidando, setConsolidando] = useState(false);
  const [reciboConvenio, setReciboConvenio] = useState(null);

  const TAM_LISTA = 12;

  // Cada cambio de búsqueda o filtro vuelve a la primera página
  useEffect(() => {
    setPaginaLista(1);
  }, [busqueda, filtroLista]);

  // Lista de socios: se consulta con retardo para no pedir datos en cada tecla
  useEffect(() => {
    if (socio) return;
    let activo = true;
    const t = setTimeout(async () => {
      setCargandoLista(true);
      try {
        const res = await axios.get(`${API_URL}/usuarios`, {
          headers,
          params: {
            rol: "Socio",
            search: busqueda.trim() || undefined,
            filtro: filtroLista || undefined,
            orden: "nombre",
            page: paginaLista,
            limit: TAM_LISTA,
          },
        });
        if (!activo) return;
        setLista(res.data.data || []);
        setTotalLista(res.data.pagination?.total || 0);
      } catch {
        if (!activo) return;
        setLista([]);
        setTotalLista(0);
      } finally {
        if (activo) setCargandoLista(false);
      }
    }, busqueda ? 300 : 0);
    return () => {
      activo = false;
      clearTimeout(t);
    };
  }, [busqueda, filtroLista, paginaLista, socio, headers]);

  const cargarFicha = async (u) => {
    try {
      sessionStorage.setItem("ventanilla_socio", JSON.stringify(u));
    } catch {
      // sin almacenamiento disponible: solo se pierde la restauración al volver
    }
    setDetalle(null);
    setVerEstadoCuenta(false);
    setPestana("expediente");
    setSocio(u);
    setBusqueda("");
    setFicha(null);
    setCargandoFicha(true);
    try {
      const q = { headers, params: { id_usuario: u.id_usuario } };
      const [pr, cu, ap] = await Promise.all([
        axios.get(`${API_URL}/prestamos`, q),
        axios.get(`${API_URL}/cuentas`, q),
        axios.get(`${API_URL}/aportaciones`, q),
      ]);
      const prestamos = pr.data.data || [];
      const proximos = {};
      await Promise.all(
        prestamos.filter(esVigente).map(async (p) => {
          try {
            const r = await axios.get(
              `${API_URL}/pagos/prestamo/${p.id_prestamo}/proximo-pago`,
              { headers }
            );
            proximos[p.id_prestamo] = r.data.proximo_pago || null;
          } catch {
            proximos[p.id_prestamo] = null;
          }
        })
      );
      setFicha({
        prestamos,
        cuentas: cu.data.data || [],
        aportaciones: ap.data.data || [],
        proximos,
      });
    } catch {
      mostrarAlerta("No se pudo cargar la información del socio.", "error");
    } finally {
      setCargandoFicha(false);
    }
  };

  const limpiar = () => {
    try {
      sessionStorage.removeItem("ventanilla_socio");
    } catch {
      // ignorar
    }
    setDetalle(null);
    setSocio(null);
    setFicha(null);
  };

  // Al volver desde otro módulo (Pagos, Préstamos...) se recupera el socio que se atendía
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem("ventanilla_socio");
      if (guardado) cargarFicha(JSON.parse(guardado));
    } catch {
      // ignorar datos corruptos
    }
    // eslint-disable-next-line
  }, []);

  const resumen = useMemo(() => {
    if (!ficha) return null;
    const vigentes = ficha.prestamos.filter(esVigente);
    return {
      vigentes,
      pendientes: ficha.prestamos.filter((p) => ["pendiente", "aprobado"].includes((p.estado || "").toLowerCase())),
      deuda: vigentes.reduce((s, p) => s + parseFloat(p.saldo_restante || 0), 0),
      saldoCuentas: ficha.cuentas.reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0),
      aportado: ficha.aportaciones.reduce((s, a) => s + parseFloat(a.monto || 0), 0),
      moraTotal: vigentes.reduce(
        (s, p) => s + parseFloat(ficha.proximos[p.id_prestamo]?.interes_moratorio || 0),
        0
      ),
      enMora: vigentes.some(
        (p) => (p.estado || "").toLowerCase() === "mora" || ficha.proximos[p.id_prestamo]?.en_mora
      ),
    };
  }, [ficha]);

  const ir = (ruta, params) => navigate(`${ruta}?${new URLSearchParams(params).toString()}`);
  const irNuevo = (ruta, extra = {}) =>
    ir(ruta, { accion: "nuevo", socio: socio.id_usuario, ...extra });
  const irVer = (ruta) => ir(ruta, { accion: "ver", q: socio.nombre_completo });

  const acciones = socio
    ? [
        {
          icon: <FaMoneyCheckAlt />,
          color: "#27ae60",
          titulo: "Pagar cuota",
          desc: resumen?.vigentes.length
            ? `${resumen.vigentes.length} préstamo(s) vigente(s)`
            : "Sin préstamos vigentes",
          deshabilitado: !resumen?.vigentes.length,
          onClick: () => {
            if (resumen.vigentes.length === 1) {
              irNuevo("/pagos", { prestamo: resumen.vigentes[0].id_prestamo });
            } else {
              setPestana("prestamos");
              document
                .getElementById("ventanilla-pestanas")
                ?.scrollIntoView({ behavior: "smooth" });
            }
          },
        },
        {
          icon: <FaHandHoldingUsd />,
          color: "#2980b9",
          titulo: "Solicitar préstamo",
          desc: "Registrar nueva solicitud",
          onClick: () => irNuevo("/prestamos"),
        },
        {
          icon: <FaPiggyBank />,
          color: "#d68910",
          titulo: "Registrar aportación",
          desc: "Aporte a capital del socio",
          onClick: () => irNuevo("/aportaciones"),
        },
        {
          icon: <FaUniversity />,
          color: "#8e44ad",
          titulo: "Abrir cuenta",
          desc: "Nueva cuenta de ahorro",
          onClick: () => irNuevo("/cuentas"),
        },
        {
          icon: <FaFileInvoiceDollar />,
          color: "#16a085",
          titulo: "Cuentas y movimientos",
          desc: "Depósitos, retiros y estado de cuenta",
          onClick: () => irVer("/cuentas"),
        },
        {
          icon: <FaFileInvoiceDollar />,
          color: "#0e7490",
          titulo: "Recibos",
          desc: "Ver, reimprimir o enviar por WhatsApp",
          onClick: () => setVerRecibos(true),
        },
        {
          icon: <FaFileSignature />,
          color: "#16a34a",
          titulo: "Carta de préstamo aprobado",
          desc: "Descargar o enviar por WhatsApp o correo",
          onClick: () => setVerCartas(true),
        },
        {
          icon: <FaFileInvoiceDollar />,
          color: "#2c3e50",
          titulo: "Estado de cuenta",
          desc: "Resumen imprimible del socio",
          onClick: () => setVerEstadoCuenta(true),
        },
        {
          icon: <FaHistory />,
          color: "#566573",
          titulo: "Historial de pagos",
          desc: "Todos los pagos del socio",
          onClick: () => irVer("/pagos"),
        },
      ]
    : [];

  const pestanas = [
    { clave: "expediente", titulo: "Expediente", icono: <FaFolderOpen /> },
    { clave: "aval", titulo: "Aval y referencias", icono: <FaUserShield /> },
    { clave: "prestamos", titulo: "Préstamos", icono: <FaHandHoldingUsd />, cuenta: resumen?.vigentes.length },
    { clave: "cuentas", titulo: "Cuentas y aportaciones", icono: <FaPiggyBank /> },
  ];

  if (socio && verEstadoCuenta) {
    return (
      <EstadoCuentaSocio
        idSocio={socio.id_usuario}
        headers={headers}
        onBack={() => setVerEstadoCuenta(false)}
        textoVolver={`Volver a la ficha de ${socio.nombre_completo}`}
      />
    );
  }

  if (socio && detalle) {
    return (
      <DetallePrestamoVentanilla
        idPrestamo={detalle}
        nombreSocio={socio.nombre_completo}
        headers={headers}
        prox={ficha?.proximos?.[detalle]}
        onBack={() => setDetalle(null)}
        onCobrar={() => irNuevo("/pagos", { prestamo: detalle })}
        onLiquidar={() => irNuevo("/pagos", { prestamo: detalle, tipo: "desglose" })}
      />
    );
  }

  return (
    <div className="container-fluid py-3">
      <style>{`
        .vt-card { border: 0; border-radius: 1rem; box-shadow: 0 2px 12px #0000000f; background: #fff; }
        .vt-result { cursor: pointer; transition: background .15s; }
        .vt-result:hover { background: #f4f8e8; }
        .vt-action { border: 1.5px solid #e8edf3; border-radius: 1rem; background: #fff; padding: 1rem;
          text-align: left; width: 100%; height: 100%; transition: all .18s; }
        .vt-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px #0000001a; border-color: ${ACCENT}; }
        .vt-action:disabled { opacity: .5; cursor: not-allowed; }
        .vt-kpi { border-radius: .9rem; padding: .85rem 1rem; background: #f6f8fb; }
        .vt-tabs { overflow-x: auto; scrollbar-width: none; }
        .vt-tab { display: flex; align-items: center; gap: .45rem; white-space: nowrap; border: 0; background: none;
          padding: .95rem 1rem; color: #64748b; font-weight: 600; border-bottom: 3px solid transparent; margin-bottom: -1px; }
        .vt-tab:hover { color: ${AZUL}; }
        .vt-tab.activa { color: ${AZUL}; border-bottom-color: ${ACCENT}; }
      `}</style>

      <div className="mb-3">
        <h3 className="fw-bold mb-0" style={{ color: AZUL }}>Ventanilla</h3>
        <span className="text-muted">Elija un socio de la lista, o búsquelo, para atenderlo.</span>
      </div>

      {/* Buscador */}
      <div className="vt-card p-3 mb-4">
        <div className="input-group input-group-lg">
          <span className="input-group-text bg-white border-end-0">
            <FaSearch className="text-muted" />
          </span>
          <input
            type="text"
            className="form-control border-start-0"
            placeholder="Buscar por nombre, identidad o correo..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              // Si se está viendo la ficha de un socio, escribir vuelve a la lista con esa búsqueda
              if (socio && e.target.value.trim()) limpiar();
            }}
            autoFocus
          />
          {socio && (
            <button className="btn btn-outline-secondary" onClick={limpiar} title="Atender a otro socio">
              <FaTimes /> Limpiar
            </button>
          )}
        </div>

      </div>

      {consolidando && socio && resumen && (
        <ConsolidarPrestamos
          socio={socio}
          prestamos={resumen.vigentes}
          headers={headers}
          onClose={() => setConsolidando(false)}
          onListo={(r) => {
            setConsolidando(false);
            setReciboConvenio(r.id_recibo);
            mostrarAlerta("Préstamos consolidados correctamente.", "success");
            cargarFicha(socio);
          }}
        />
      )}

      {reciboConvenio && <ReciboModal idRecibo={reciboConvenio} onClose={() => setReciboConvenio(null)} />}

      {verRecibos && socio && (
        <RecibosSocioModal
          idSocio={socio.id_usuario}
          nombreSocio={socio.nombre_completo}
          telefono={socio.telefono}
          headers={headers}
          onClose={() => setVerRecibos(false)}
        />
      )}

      {verCartas && socio && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,.6)", zIndex: 5500, position: "fixed", inset: 0, overflowY: "auto" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold">Carta de préstamo aprobado</h5>
                  <div className="small text-muted">{socio.nombre_completo}</div>
                </div>
                <button type="button" className="btn-close" onClick={() => setVerCartas(false)} />
              </div>
              <div className="modal-body">
                <CartasAprobacionSocio idSocio={socio.id_usuario} telefono={socio.telefono} headers={headers} titulo={false} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!socio && (
        <div className="vt-card mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 border-bottom">
            <div className="fw-bold" style={{ color: AZUL }}>
              Socios <span className="text-muted fw-normal">({totalLista})</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {[
                ["", "Todos"],
                ["con_prestamo", "Con préstamo"],
                ["en_mora", "En mora"],
                ["sin_prestamo", "Sin préstamo"],
              ].map(([valor, etiqueta]) => (
                <button
                  key={valor || "todos"}
                  className="btn btn-sm"
                  onClick={() => setFiltroLista(valor)}
                  style={{
                    background: filtroLista === valor ? AZUL : "#fff",
                    color: filtroLista === valor ? "#fff" : AZUL,
                    border: `1.5px solid ${AZUL}`,
                    borderRadius: 20,
                    fontWeight: 600,
                  }}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          {cargandoLista && lista.length === 0 ? (
            <TablaSkeleton filas={6} columnas={4} />
          ) : lista.length === 0 ? (
            <EmptyState
              icono={<FaUserCircle />}
              titulo="No se encontraron socios"
              descripcion={busqueda ? "Prueba con otro nombre o número de identidad." : "Todavía no hay socios con este filtro."}
            />
          ) : (
            <div className="table-responsive" style={{ opacity: cargandoLista ? 0.5 : 1, transition: "opacity .15s" }}>
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="small text-muted text-uppercase">
                    <th>Socio</th>
                    <th>Teléfono</th>
                    <th className="text-center">Préstamos</th>
                    <th className="text-end">Saldo de préstamos</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((u) => {
                    const enMora = parseInt(u.prestamos_en_mora) > 0;
                    const estado = (u.estado || "").toLowerCase();
                    return (
                      <tr key={u.id_usuario} className="vt-result" onClick={() => cargarFicha(u)}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <FaUserCircle size={30} color="#9aa5b1" />
                            <div>
                              <div className="fw-semibold">{u.nombre_completo}</div>
                              <div className="small text-muted">
                                <FaIdCard className="me-1" />
                                {u.dni || "Sin identidad"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="small">{u.telefono || "—"}</td>
                        <td className="text-center">
                          {parseInt(u.prestamos_vigentes) > 0 ? (
                            <span className="badge bg-light text-dark border">{u.prestamos_vigentes}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-end fw-semibold">
                          {parseFloat(u.saldo_prestamos) > 0 ? `L. ${fmt(u.saldo_prestamos)}` : <span className="text-muted fw-normal">—</span>}
                        </td>
                        <td>
                          {enMora ? (
                            <span className="badge rounded-pill" style={{ background: "#fee2e2", color: "#991b1b" }}>
                              En mora
                            </span>
                          ) : estado === "pendiente" ? (
                            <span className="badge rounded-pill" style={{ background: "#fef3c7", color: "#92400e" }}>
                              Pendiente
                            </span>
                          ) : estado === "activo" ? (
                            <span className="badge rounded-pill" style={{ background: "#d1fae5", color: "#065f46" }}>
                              {parseInt(u.prestamos_vigentes) > 0 ? "Al día" : "Activo"}
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-secondary">{u.estado}</span>
                          )}
                        </td>
                        <td className="text-end text-muted">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Paginacion
            total={totalLista}
            pagina={paginaLista}
            tam={TAM_LISTA}
            onCambiar={setPaginaLista}
            etiqueta="socios"
          />
        </div>
      )}

      {socio && (
        <>
          {/* Ficha */}
          <div className="vt-card p-4 mb-4">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <FaUserCircle size={52} color={AZUL} />
              <div className="flex-grow-1">
                <h4 className="fw-bold mb-0" style={{ color: AZUL }}>{socio.nombre_completo}</h4>
                <div className="text-muted">
                  Identidad: {socio.dni || "—"} · Estado: {socio.estado || "—"}
                </div>
              </div>
              {resumen?.enMora && (
                <span className="badge rounded-pill px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  <FaExclamationTriangle className="me-1" /> Cuota en mora
                  {resumen.moraTotal > 0 && <> · Mora generada L. {fmt(resumen.moraTotal)}</>}
                </span>
              )}
            </div>

            {cargandoFicha || !resumen ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-success" />
              </div>
            ) : (
              <div className="row g-2">
                <div className="col-6 col-lg-3">
                  <div className="vt-kpi">
                    <div className="small text-muted">Saldo en cuentas</div>
                    <div className="fw-bold fs-5">L. {fmt(resumen.saldoCuentas)}</div>
                  </div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="vt-kpi">
                    <div className="small text-muted">Total aportado</div>
                    <div className="fw-bold fs-5">L. {fmt(resumen.aportado)}</div>
                  </div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="vt-kpi">
                    <div className="small text-muted">Saldo de préstamos</div>
                    <div className="fw-bold fs-5" style={{ color: resumen.deuda > 0 ? "#92400e" : "inherit" }}>
                      L. {fmt(resumen.deuda)}
                    </div>
                  </div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="vt-kpi">
                    <div className="small text-muted">Solicitudes pendientes</div>
                    <div className="fw-bold fs-5">{resumen.pendientes.length}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pestañas con la información del socio */}
          <div id="ventanilla-pestanas" className="vt-card mb-4 overflow-hidden">
            <div className="vt-tabs d-flex border-bottom px-2">
              {pestanas.map((t) => (
                <button
                  key={t.clave}
                  type="button"
                  className={`vt-tab ${pestana === t.clave ? "activa" : ""}`}
                  onClick={() => setPestana(t.clave)}
                >
                  {t.icono}
                  <span>{t.titulo}</span>
                  {t.cuenta > 0 && <span className="badge rounded-pill bg-light text-dark border ms-1">{t.cuenta}</span>}
                </button>
              ))}
            </div>
            <div className="p-4">
              {pestana === "expediente" && (
                <ExpedienteSocio key={socio.id_usuario} idSocio={socio.id_usuario} headers={headers} />
              )}
              {pestana === "aval" && (
                <SolicitudesSocioFicha key={socio.id_usuario} idSocio={socio.id_usuario} headers={headers} />
              )}
              {pestana === "prestamos" && (!resumen ? (
                <div className="spinner-border spinner-border-sm text-success" />
              ) : resumen.vigentes.length === 0 ? (
                <div className="small text-muted">El socio no tiene préstamos vigentes.</div>
              ) : (
                <div className="row g-3">
                {esSuperAdmin && resumen.vigentes.length >= 2 && (
                  <div className="col-12">
                    <div
                      className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 rounded-4"
                      style={{ background: "#f0f7e6", border: "1px solid #cfe5a0" }}
                    >
                      <div className="small">
                        <strong>Este socio tiene {resumen.vigentes.length} préstamos vigentes.</strong> Puedes juntarlos en
                        uno solo, con otra tasa y otro plazo.
                      </div>
                      <button
                        className="btn fw-semibold"
                        style={{ background: ACCENT, color: "#1a2a00" }}
                        onClick={() => setConsolidando(true)}
                      >
                        Consolidar préstamos
                      </button>
                    </div>
                  </div>
                )}
                {resumen.vigentes.map((p) => {
                  const prox = ficha.proximos[p.id_prestamo];
                  return (
                    <div className="col-12 col-xl-6" key={p.id_prestamo}>
                      <div className="border rounded-4 p-3 h-100">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="fw-bold">Préstamo #{p.id_prestamo} · L. {fmt(p.monto)}</div>
                            <div className="small text-muted">
                              Plazo: {parseInt(p.plazo_meses) === 0 ? "Indefinido" : `${p.plazo_meses} meses`}
                            </div>
                          </div>
                          {prox?.en_mora && (
                            <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
                              {prox.dias_mora} día(s) de mora
                            </span>
                          )}
                        </div>
                        <div className="row g-2 mb-3">
                          <div className="col-4">
                            <div className="small text-muted">Saldo</div>
                            <div className="fw-bold">L. {fmt(p.saldo_restante)}</div>
                          </div>
                          <div className="col-4">
                            <div className="small text-muted">Cuota</div>
                            <div className="fw-bold">L. {fmt(prox?.cuota_mensual ?? p.cuota_mensual)}</div>
                          </div>
                          <div className="col-4">
                            <div className="small text-muted">Vence</div>
                            <div className="fw-bold">{prox?.fecha_vencimiento || "—"}</div>
                          </div>
                        </div>
                        {prox?.en_mora && (
                          <div className="small mb-2" style={{ color: "#991b1b" }}>
                            Mora generada: <strong>L. {fmt(prox.interes_moratorio)}</strong>
                            {prox.mora_por_dia > 0 && <> · genera L. {fmt(prox.mora_por_dia)} por día</>}
                          </div>
                        )}
                        {prox?.total_para_saldar != null && (
                          <div className="small text-muted mb-3">
                            Para saldar hoy ({prox.dias_desde_ultimo_pago} día(s) desde el último pago):{" "}
                            <strong>L. {fmt(prox.total_para_saldar)}</strong>
                          </div>
                        )}
                        <button
                          className="btn btn-outline-primary fw-semibold w-100 mb-2"
                          onClick={() => setDetalle(p.id_prestamo)}
                        >
                          Ver detalles y tabla de amortización
                        </button>
                        <div className="d-flex gap-2">
                          <button
                            className="btn fw-semibold flex-fill"
                            style={{ background: ACCENT, color: "#1a2a00" }}
                            onClick={() => irNuevo("/pagos", { prestamo: p.id_prestamo })}
                          >
                            <FaMoneyCheckAlt className="me-2" />
                            Cobrar cuota
                          </button>
                          <button
                            className="btn btn-outline-dark fw-semibold flex-fill"
                            title="Pagar el préstamo completo: saldo + interés"
                            onClick={() => irNuevo("/pagos", { prestamo: p.id_prestamo, tipo: "desglose" })}
                          >
                            Liquidar total
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              ))}
              {pestana === "cuentas" && (!ficha ? (
                <div className="spinner-border spinner-border-sm text-success" />
              ) : (
                <div className="row g-4">
                  <div className="col-12 col-lg-6">
                    <h6 className="fw-bold mb-3" style={{ color: AZUL }}>Cuentas</h6>
                    {ficha.cuentas.length === 0 ? (
                      <div className="small text-muted">El socio no tiene cuentas abiertas.</div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {ficha.cuentas.map((c) => (
                          <div key={c.id_cuenta} className="vt-kpi d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-semibold">{c.tipo_cuenta}</div>
                              <div className="small text-muted">
                                {c.estado}{c.fecha_apertura ? ` · desde ${String(c.fecha_apertura).substring(0, 10)}` : ""}
                              </div>
                            </div>
                            <div className="fw-bold">L. {fmt(c.saldo_actual)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-12 col-lg-6">
                    <h6 className="fw-bold mb-3" style={{ color: AZUL }}>Últimas aportaciones</h6>
                    {ficha.aportaciones.length === 0 ? (
                      <div className="small text-muted">El socio no ha hecho aportaciones.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr className="small text-muted">
                              <th>Fecha</th>
                              <th>Tipo</th>
                              <th className="text-end">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...ficha.aportaciones]
                              .sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)))
                              .slice(0, 8)
                              .map((a) => (
                                <tr key={a.id_aportacion}>
                                  <td className="small">{String(a.fecha || "").substring(0, 10)}</td>
                                  <td className="small text-capitalize">{a.tipo_aportacion || "—"}</td>
                                  <td className="text-end fw-semibold">L. {fmt(a.monto)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <h5 className="fw-bold mb-3" style={{ color: AZUL }}>¿Qué desea hacer el socio?</h5>
          <div className="row g-3 mb-4">
            {acciones.map((a) => (
              <div className="col-12 col-md-6 col-xl-4" key={a.titulo}>
                <button className="vt-action" onClick={a.onClick} disabled={a.deshabilitado || cargandoFicha}>
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{ width: 46, height: 46, borderRadius: ".8rem", background: `${a.color}1a`, color: a.color, fontSize: 20 }}
                    >
                      {a.icon}
                    </div>
                    <div>
                      <div className="fw-bold" style={{ color: AZUL }}>{a.titulo}</div>
                      <div className="small text-muted">{a.desc}</div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );
}
