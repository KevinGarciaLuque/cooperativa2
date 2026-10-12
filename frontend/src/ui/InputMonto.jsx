// Campo de dinero: muestra separador de miles mientras se escribe (50,000.00)
// y entrega al formulario el número limpio ("50000.00").
const formatear = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return "";
  const [entero, decimales] = String(valor).split(".");
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimales !== undefined ? `${conComas}.${decimales}` : conComas;
};

export default function InputMonto({ value, onChange, className = "form-control", ...resto }) {
  const cambiar = (e) => {
    const limpio = e.target.value.replace(/,/g, "");
    if (limpio !== "" && !/^\d*\.?\d{0,2}$/.test(limpio)) return;
    onChange(limpio);
  };

  return (
    <input
      {...resto}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={formatear(value)}
      onChange={cambiar}
    />
  );
}
