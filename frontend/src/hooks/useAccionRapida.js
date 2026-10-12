import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// Permite que la Ventanilla abra un módulo ya posicionado en el socio:
//   ?accion=nuevo&socio=<id>[&prestamo=<id>][&tipo=desglose]  -> abre el formulario de creación prellenado
//   ?accion=ver&q=<texto>                     -> aplica el filtro de búsqueda
// `listo` debe ser true cuando el módulo terminó de cargar sus datos.
export default function useAccionRapida(listo, onAccion) {
  const [params, setParams] = useSearchParams();
  const ejecutada = useRef(false);

  useEffect(() => {
    if (!listo || ejecutada.current) return;
    const accion = params.get("accion");
    if (!accion) return;
    ejecutada.current = true;
    onAccion({
      accion,
      socio: params.get("socio"),
      prestamo: params.get("prestamo"),
      tipo: params.get("tipo"),
      q: params.get("q") || "",
    });
    setParams({}, { replace: true });
    // eslint-disable-next-line
  }, [listo]);
}
