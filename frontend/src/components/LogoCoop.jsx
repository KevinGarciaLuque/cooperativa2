/**
 * LogoCoop — Logo de Demo
 * Usa el logo subido via configuración del sitio si existe,
 * de lo contrario usa /smartcoop.png (carpeta public).
 * Props:
 *   size      → ancho en px (default 48, alto proporcional automático)
 *   withText  → reservado para compatibilidad
 *   logoUrl   → URL dinámica desde configuración (opcional)
 *   style, className
 */
export default function LogoCoop({
  size = 100,
  withText = false,
  logoUrl = null,
  style = {},
  className = "",
}) {
  const src = logoUrl || "/smartcoop.png";

  return (
    <img
      src={src}
      alt="Demo"
      className={className}
      style={{
        width: size,
        height: "auto",
        display: "block",
        flexShrink: 0,
        objectFit: "contain",
        ...style,
      }}
    />
  );
}

