// Función pura de paginación (usable también en componentes con retornos anticipados)
export function paginar(items, pagina, tam) {
  const totalPaginas = Math.max(1, Math.ceil(items.length / tam));
  const actual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (actual - 1) * tam;
  return { items: items.slice(inicio, inicio + tam), pagina: actual, totalPaginas, total: items.length, inicio };
}
