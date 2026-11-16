// Campo de dinero: muestra separador de miles mientras se escribe (50,000.00, o 50 000,00 en
// Costa Rica) y entrega al formulario el número limpio ("50000.00").
import { montoATexto, textoAMonto } from "../utils/pais";

export default function InputMonto({ value, onChange, className = "form-control", ...resto }) {
  const cambiar = (e) => {
    const limpio = textoAMonto(e.target.value);
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
      value={montoATexto(value)}
      onChange={cambiar}
    />
  );
}
