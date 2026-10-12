// Campos de la solicitud de préstamo. Los usan el panel del socio y el enlace de registro,
// para que ambos pidan exactamente lo mismo.
import InputMonto from "../ui/InputMonto";
import { OCUPACIONES, PROPOSITOS, fmt, simular } from "../utils/solicitud";
import { formatearNombre } from "../utils/nombres";

export const AvisoRelacion = ({ sim }) =>
  sim.relacionAlta ? (
    <div className="alert alert-warning py-2 mt-2 mb-0 small">
      La cuota sería el {sim.relacion.toFixed(0)}% de tu ingreso mensual. La cooperativa puede pedirte un plazo mayor o
      un monto menor.
    </div>
  ) : null;

// ¿Cuánto, en cuánto tiempo y cuánto puede pagar? + cuota estimada
export function CamposMonto({ param, form, setForm }) {
  const sim = simular(param, form);
  const poner = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }));

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">¿Cuánto necesitas? (L.) *</label>
        <InputMonto
          required className="form-control form-control-lg" placeholder="0.00"
          value={form.monto} onChange={poner("monto")}
        />
        {param && <div className="form-text">Máximo {fmt(param.monto_max)}</div>}
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">¿En cuántos meses lo pagarás? *</label>
        <input
          type="number" min="1" max={param?.plazo_max || 60} step="1" required className="form-control form-control-lg"
          value={form.plazo_meses} onChange={(e) => poner("plazo_meses")(e.target.value)} placeholder="Ej: 6"
        />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">¿Cuánto puedes pagar al mes? (L.) *</label>
        <InputMonto
          required className="form-control form-control-lg" placeholder="0.00"
          value={form.cuota_posible} onChange={poner("cuota_posible")}
        />
      </div>

      {sim.cuotaEstimada > 0 && (
        <div className="col-12">
          <div className="p-3" style={{ background: "#f0f7e6", borderRadius: 12, border: "1px solid #cfe5a0" }}>
            <div className="row g-2 text-center justify-content-center">
              <div className="col-6 col-md-4">
                <div className="small text-muted">Cuota estimada al mes</div>
                <div className="fw-bold fs-4">{fmt(sim.cuotaEstimada)}</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="small text-muted">Plazo</div>
                <div className="fw-bold fs-4">{sim.plazo} {sim.plazo === 1 ? "mes" : "meses"}</div>
              </div>
            </div>
            <div className="small text-muted text-center mt-2">
              Es un cálculo aproximado. La cuota final depende de las condiciones que apruebe la cooperativa.
            </div>
            {sim.superaCapacidad && (
              <div className="alert alert-warning py-2 mt-3 mb-0 small">
                La cuota estimada ({fmt(sim.cuotaEstimada)}) es mayor a lo que dices poder pagar ({fmt(sim.cuotaPosible)}).
                {sim.plazoSugerido && <> Con <strong>{sim.plazoSugerido} meses</strong> la cuota se ajusta a tu capacidad.</>}
              </div>
            )}
            <AvisoRelacion sim={sim} />
          </div>
        </div>
      )}
    </div>
  );
}

// Destino del préstamo, ingresos, aval (obligatorio) y referencia personal (opcional)
export function CamposIngresos({ form, setForm }) {
  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="row g-3">
      <div className="col-12 col-md-6">
        <label className="form-label fw-semibold small">¿Para qué usarás el préstamo? *</label>
        <select required className="form-select" name="proposito" value={form.proposito} onChange={cambiar}>
          <option value="">Selecciona...</option>
          {Object.entries(PROPOSITOS).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
      </div>
      <div className="col-12 col-md-6">
        <label className="form-label fw-semibold small">Cuéntanos un poco más</label>
        <input
          className="form-control" name="descripcion" maxLength={300} value={form.descripcion}
          onChange={cambiar} placeholder="Ej: comprar mercadería para mi pulpería"
        />
      </div>

      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">¿De qué vives? *</label>
        <select required className="form-select" name="ocupacion" value={form.ocupacion} onChange={cambiar}>
          <option value="">Selecciona...</option>
          {Object.entries(OCUPACIONES).map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">Lugar de trabajo o nombre del negocio</label>
        <input className="form-control" name="lugar_trabajo" maxLength={120} value={form.lugar_trabajo} onChange={cambiar} />
      </div>
      <div className="col-12 col-md-4">
        <label className="form-label fw-semibold small">Ingreso mensual aproximado (L.) *</label>
        <InputMonto
          required className="form-control" placeholder="0.00"
          value={form.ingreso_mensual} onChange={(v) => setForm((f) => ({ ...f, ingreso_mensual: v }))}
        />
      </div>

      {[
        [1, "Aval", "Persona que respalda tu préstamo y responde si no puedes pagar.", true],
        [2, "Referencia personal (opcional)", "Alguien que te conozca y pueda dar referencias tuyas.", false],
      ].map(([n, titulo, ayuda, obligatorio]) => (
        <div className="col-12" key={n}>
          <div className="fw-semibold small">
            {titulo} {obligatorio && <span className="text-danger">*</span>}
          </div>
          <div className="form-text mt-0 mb-2">{ayuda}</div>
          <div className="row g-2">
            <div className="col-12 col-md-5">
              <input
                className="form-control" placeholder="Nombre completo" maxLength={100} required={obligatorio}
                name={`ref${n}_nombre`} value={form[`ref${n}_nombre`]} onChange={cambiar}
                autoCapitalize="words"
                onBlur={(e) => setForm((f) => ({ ...f, [e.target.name]: formatearNombre(f[e.target.name]) }))}
              />
            </div>
            <div className="col-6 col-md-3">
              <input
                className="form-control" placeholder="Teléfono" maxLength={20} required={obligatorio} inputMode="tel"
                name={`ref${n}_telefono`} value={form[`ref${n}_telefono`]} onChange={cambiar}
              />
            </div>
            <div className="col-6 col-md-4">
              <input
                className="form-control" placeholder="Parentesco o relación" maxLength={50}
                name={`ref${n}_parentesco`} value={form[`ref${n}_parentesco`]} onChange={cambiar}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
