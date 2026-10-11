import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAlerta } from "../context/AlertaContext";
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
  const { token } = useAuth();
  const { mostrarAlerta } = useAlerta();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [socio, setSocio] = useState(null);
  const [ficha, setFicha] = useState(null); // { prestamos, cuentas, aportaciones, proximos }
  const [cargandoFicha, setCargandoFicha] = useState(false);

  // Búsqueda de socios con retardo para no consultar en cada tecla
  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await axios.get(`${API_URL}/usuarios`, {
          headers,
          params: { search: texto, limit: 8 },
        });
        const lista = res.data.data || [];
        setResultados(lista.filter((u) => u.rol === "Socio"));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, headers]);

  const cargarFicha = async (u) => {
    setSocio(u);
    setBusqueda("");
    setResultados([]);
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
    setSocio(null);
    setFicha(null);
  };

  const resumen = useMemo(() => {
    if (!ficha) return null;
    const vigentes = ficha.prestamos.filter(esVigente);
    return {
      vigentes,
      pendientes: ficha.prestamos.filter((p) => (p.estado || "").toLowerCase() === "pendiente"),
      deuda: vigentes.reduce((s, p) => s + parseFloat(p.saldo_restante || 0), 0),
      saldoCuentas: ficha.cuentas.reduce((s, c) => s + parseFloat(c.saldo_actual || 0), 0),
      aportado: ficha.aportaciones.reduce((s, a) => s + parseFloat(a.monto || 0), 0),
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
              document
                .getElementById("ventanilla-prestamos")
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
          icon: <FaHistory />,
          color: "#566573",
          titulo: "Historial de pagos",
          desc: "Todos los pagos del socio",
          onClick: () => irVer("/pagos"),
        },
      ]
    : [];

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
      `}</style>

      <div className="mb-3">
        <h3 className="fw-bold mb-0" style={{ color: AZUL }}>Ventanilla</h3>
        <span className="text-muted">Busque al socio y elija qué operación realizará.</span>
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
            placeholder="Buscar socio por nombre, identidad o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          {socio && (
            <button className="btn btn-outline-secondary" onClick={limpiar} title="Atender a otro socio">
              <FaTimes /> Limpiar
            </button>
          )}
        </div>

        {busqueda.trim().length >= 2 && (
          <div className="mt-2 border rounded-3 overflow-hidden">
            {buscando ? (
              <div className="p-3 text-muted small">Buscando...</div>
            ) : resultados.length === 0 ? (
              <div className="p-3 text-muted small">No se encontraron socios.</div>
            ) : (
              resultados.map((u) => (
                <div
                  key={u.id_usuario}
                  className="vt-result d-flex align-items-center gap-3 p-3 border-bottom"
                  onClick={() => cargarFicha(u)}
                >
                  <FaUserCircle size={28} color="#9aa5b1" />
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{u.nombre_completo}</div>
                    <div className="small text-muted">
                      <FaIdCard className="me-1" />
                      {u.dni || "Sin identidad"}
                    </div>
                  </div>
                  {u.prestamos_activos > 0 && (
                    <span className="badge bg-light text-dark border">
                      {u.prestamos_activos} préstamo(s)
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {!socio && (
        <div className="text-center text-muted py-5">
          <FaUserCircle size={56} style={{ opacity: 0.25 }} />
          <p className="mt-3 mb-0">Escriba al menos 2 letras para buscar un socio.</p>
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

          {/* Préstamos vigentes */}
          {resumen && resumen.vigentes.length > 0 && (
            <div id="ventanilla-prestamos">
              <h5 className="fw-bold mb-3" style={{ color: AZUL }}>Préstamos vigentes</h5>
              <div className="row g-3">
                {resumen.vigentes.map((p) => {
                  const prox = ficha.proximos[p.id_prestamo];
                  return (
                    <div className="col-12 col-xl-6" key={p.id_prestamo}>
                      <div className="vt-card p-3">
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
                        <button
                          className="btn fw-semibold w-100"
                          style={{ background: ACCENT, color: "#1a2a00" }}
                          onClick={() => irNuevo("/pagos", { prestamo: p.id_prestamo })}
                        >
                          <FaMoneyCheckAlt className="me-2" />
                          Cobrar cuota
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
