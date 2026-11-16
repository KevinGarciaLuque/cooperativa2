// Medio con el que entra o sale el dinero: define si se registra en la caja (efectivo) o en
// bancos (transferencia, cheque o depósito) tanto en el libro de caja como en contabilidad.
const MEDIOS = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  ["deposito", "Depósito bancario"],
  ["cheque", "Cheque"],
];

export default function SelectorMedio({ value, onChange, name = "metodo", className = "form-select", style }) {
  return (
    <select className={className} name={name} value={value || "efectivo"} onChange={onChange} style={style}>
      {MEDIOS.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}
