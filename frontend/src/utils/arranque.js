// Lo que la aplicación necesita saber antes de mostrarse: el país de la cooperativa (moneda,
// documento de identidad) y si es el ambiente de pruebas. Como mucho espera unos segundos
// para no retrasar la entrada; si el servidor no responde, se usa lo último conocido.
import { establecerPais } from "./pais";

let ambiente = "produccion";
export const esAmbientePruebas = () => ambiente === "pruebas";

export const cargarArranque = (apiUrl, espera = 4000) =>
  Promise.race([
    fetch(`${apiUrl}/configuracion`)
      .then((r) => r.json())
      .then((r) => {
        establecerPais(r?.data?.pais_datos);
        ambiente = r?.data?.ambiente === "pruebas" ? "pruebas" : "produccion";
      })
      .catch(() => {}),
    new Promise((listo) => setTimeout(listo, espera)),
  ]);
