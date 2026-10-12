import { useMemo, useState } from "react";
import { paginar } from "./paginar";
import { FaChevronLeft, FaChevronRight, FaSortUp, FaSortDown, FaInbox } from "react-icons/fa";

/* ── Encabezado de página ─────────────────────────────────────── */
export function PageHeader({ icono, titulo, subtitulo, acciones }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 ui-no-print">
      <div>
        <h3 className="ui-page-title">
          {icono && <span className="me-2">{icono}</span>}
          {titulo}
        </h3>
        {subtitulo && <div className="ui-page-sub">{subtitulo}</div>}
      </div>
      {acciones && <div className="d-flex flex-wrap align-items-center gap-2">{acciones}</div>}
    </div>
  );
}

/* ── Indicador ────────────────────────────────────────────────── */
export function StatCard({ etiqueta, valor, color, nota }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat-label">{etiqueta}</div>
      <div className="ui-stat-value" style={color ? { color } : undefined}>{valor}</div>
      {nota && <div className="small text-muted">{nota}</div>}
    </div>
  );
}

/* ── Estado vacío ─────────────────────────────────────────────── */
export function EmptyState({ icono, titulo, descripcion, accion }) {
  return (
    <div className="text-center py-5 px-3">
      <div style={{ fontSize: 40, opacity: 0.3 }}>{icono || <FaInbox />}</div>
      <div className="fw-semibold mt-2" style={{ color: "var(--ui-texto-suave)" }}>{titulo}</div>
      {descripcion && <div className="small text-muted">{descripcion}</div>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/* ── Esqueletos de carga ──────────────────────────────────────── */
export function Skeleton({ ancho = "100%", alto = "1em", style }) {
  return <span className="ui-skeleton" style={{ width: ancho, height: alto, ...style }} />;
}

export function TablaSkeleton({ filas = 6, columnas = 5 }) {
  return (
    <div className="p-3">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="d-flex gap-3 py-2">
          {Array.from({ length: columnas }).map((__, j) => (
            <Skeleton key={j} alto="1.1em" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PaginaSkeleton() {
  return (
    <div className="container-fluid py-3" aria-busy="true">
      <Skeleton ancho="260px" alto="1.6em" />
      <div className="mt-2 mb-4"><Skeleton ancho="380px" alto="1em" /></div>
      <div className="ui-card"><TablaSkeleton filas={7} columnas={5} /></div>
    </div>
  );
}

/* ── Paginación ───────────────────────────────────────────────── */
export function Paginacion({ total, pagina, tam, onCambiar, etiqueta = "registros" }) {
  const totalPaginas = Math.max(1, Math.ceil(total / tam));
  if (total <= tam) return null;
  const desde = (pagina - 1) * tam + 1;
  const hasta = Math.min(total, pagina * tam);

  // Ventana de páginas alrededor de la actual
  const paginas = [];
  const ini = Math.max(1, pagina - 2);
  const fin = Math.min(totalPaginas, ini + 4);
  for (let p = Math.max(1, fin - 4); p <= fin; p++) paginas.push(p);

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 ui-no-print">
      <span className="small text-muted">
        {desde}–{hasta} de {total} {etiqueta}
      </span>
      <div className="btn-group btn-group-sm">
        <button className="btn btn-outline-secondary" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)} aria-label="Página anterior">
          <FaChevronLeft />
        </button>
        {paginas.map((p) => (
          <button
            key={p}
            className={`btn ${p === pagina ? "btn-dark" : "btn-outline-secondary"}`}
            onClick={() => onCambiar(p)}
          >
            {p}
          </button>
        ))}
        <button className="btn btn-outline-secondary" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)} aria-label="Página siguiente">
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}

/* ── Tabla de datos con orden y paginación ────────────────────── */
// columnas: [{ clave, titulo, render?(fila), alinear?: "end"|"center", ordenable?, valor?(fila) }]
export function DataTable({
  columnas,
  filas,
  claveFila,
  tam = 15,
  cargando = false,
  vacio,
  rowClass,
  etiqueta = "registros",
}) {
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState({ clave: null, asc: true });

  const ordenadas = useMemo(() => {
    if (!orden.clave) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    const valorDe = (f) => (col?.valor ? col.valor(f) : f[orden.clave]);
    return [...filas].sort((a, b) => {
      const va = valorDe(a);
      const vb = valorDe(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
      return orden.asc ? r : -r;
    });
  }, [filas, orden, columnas]);

  const pag = paginar(ordenadas, pagina, tam);

  const alternar = (clave) =>
    setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }));

  if (cargando) return <TablaSkeleton />;
  if (!filas.length) return vacio || <EmptyState titulo="Sin registros" />;

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 ui-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.clave}
                  className={`${c.alinear ? `text-${c.alinear}` : ""} ${c.ordenable ? "ui-ordenable" : ""}`}
                  onClick={c.ordenable ? () => alternar(c.clave) : undefined}
                >
                  {c.titulo}
                  {c.ordenable && orden.clave === c.clave && (orden.asc ? <FaSortUp className="ms-1" /> : <FaSortDown className="ms-1" />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pag.items.map((f, i) => (
              <tr key={claveFila ? claveFila(f) : i} className={rowClass ? rowClass(f) : undefined}>
                {columnas.map((c) => (
                  <td key={c.clave} className={c.alinear ? `text-${c.alinear}` : ""}>
                    {c.render ? c.render(f) : f[c.clave]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion total={ordenadas.length} pagina={pag.pagina} tam={tam} onCambiar={setPagina} etiqueta={etiqueta} />
    </>
  );
}
