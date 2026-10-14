import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import { buscarPaises } from "../utils/paises";

// Botón con bandera y código (+504); al tocarlo abre una lista con buscador por nombre o código.
export default function SelectorPaisTel({ pais, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const caja = useRef(null);
  const buscador = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    buscador.current?.focus();
    const fuera = (e) => !caja.current?.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const lista = buscarPaises(texto);
  const elegir = (p) => {
    onChange(p);
    setAbierto(false);
    setTexto("");
  };
  // Separa los frecuentes del resto solo cuando no se está buscando
  const separador = !texto && lista.findIndex((p) => !p.frecuente);

  return (
    <div ref={caja} className="position-relative d-flex">
      <button
        type="button"
        className="input-group-text bg-white h-100"
        style={{ borderRadius: "10px 0 0 10px", gap: 6, paddingRight: 10, borderRight: 0 }}
        aria-label={`País del teléfono: ${pais.nombre}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span>{pais.bandera}</span>
        <span className="fw-semibold">+{pais.codigo}</span>
        <FaChevronDown size={11} className="text-muted" />
      </button>

      {abierto && (
        <div
          className="position-absolute bg-white border rounded-3 shadow"
          style={{ top: "calc(100% + 4px)", left: 0, zIndex: 1060, width: "min(320px, calc(100vw - 32px))" }}
        >
          <div className="p-2 border-bottom position-relative">
            <FaSearch size={12} className="text-muted position-absolute" style={{ left: 20, top: "50%", transform: "translateY(-50%)" }} />
            <input
              ref={buscador}
              className="form-control form-control-sm"
              style={{ paddingLeft: 30 }}
              placeholder="Buscar país o código"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (lista.length) elegir(lista[0]);
                }
              }}
            />
          </div>
          <ul className="list-unstyled mb-0 py-1" style={{ maxHeight: 260, overflowY: "auto" }} role="listbox">
            {lista.map((p, i) => (
              <li key={p.clave} role="option" aria-selected={p.clave === pais.clave}>
                {i === separador && i > 0 && <hr className="my-1" />}
                <button
                  type="button"
                  className={`btn btn-sm w-100 text-start d-flex align-items-center gap-2 rounded-0 ${p.clave === pais.clave ? "btn-light fw-semibold" : ""}`}
                  onClick={() => elegir(p)}
                >
                  <span>{p.bandera}</span>
                  <span className="flex-grow-1 text-truncate">{p.nombre}</span>
                  <span className="text-muted small">+{p.codigo}</span>
                </button>
              </li>
            ))}
            {!lista.length && <li className="text-muted small text-center py-3">No se encontró ningún país</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
