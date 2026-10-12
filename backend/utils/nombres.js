// Nombres propios con mayúscula inicial: "maría josé HERNÁNDEZ" → "María José Hernández".
// Las partículas (de, del, la, los, y...) van en minúscula dentro del nombre: "María de los Ángeles".
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "van", "von"]);

const mayusculaInicial = (p) => (p ? p.charAt(0).toLocaleUpperCase("es") + p.slice(1) : p);

const formatearNombre = (texto) => {
  const palabras = String(texto ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es").split(" ");
  return palabras
    .map((palabra, i) =>
      i > 0 && PARTICULAS.has(palabra)
        ? palabra
        : palabra
            .split("-")
            .map((parte) => parte.split("'").map(mayusculaInicial).join("'"))
            .join("-")
    )
    .join(" ");
};

module.exports = { formatearNombre };
