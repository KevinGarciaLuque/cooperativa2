// "N.º 0015": cómo se muestra el número de socio en pantallas, recibos y estados de cuenta
export const numeroSocio = (n) => (n ? `N.º ${String(n).padStart(4, "0")}` : null);
