// Muestra el texto de una política con un formato sencillo:
//   "# Título"  → subtítulo
//   "- punto"   → lista con viñetas
//   línea vacía → separa párrafos
export default function TextoPolitica({ texto }) {
  const bloques = [];
  let lista = null;
  String(texto || "")
    .split("\n")
    .forEach((linea, i) => {
      const t = linea.trim();
      if (t.startsWith("- ") || t.startsWith("• ")) {
        if (!lista) {
          lista = [];
          bloques.push({ tipo: "lista", items: lista, k: i });
        }
        lista.push(t.substring(2));
        return;
      }
      lista = null;
      if (!t) return;
      if (t.startsWith("#")) bloques.push({ tipo: "titulo", texto: t.replace(/^#+\s*/, ""), k: i });
      else bloques.push({ tipo: "parrafo", texto: t, k: i });
    });

  return (
    <div style={{ lineHeight: 1.6 }}>
      {bloques.map((b) =>
        b.tipo === "titulo" ? (
          <h6 key={b.k} className="fw-bold mt-3 mb-2" style={{ color: "#1a2035" }}>
            {b.texto}
          </h6>
        ) : b.tipo === "lista" ? (
          <ul key={b.k} className="mb-2 ps-4">
            {b.items.map((it, j) => (
              <li key={j} className="mb-1">
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <p key={b.k} className="mb-2">
            {b.texto}
          </p>
        )
      )}
    </div>
  );
}
