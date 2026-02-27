/**
 * LogoCoop — Logo de Smart Coop
 * Usa /smartcoop.png (carpeta public) con fondo transparente.
 * Props:
 *   size      → ancho en px (default 48, alto proporcional automático)
 *   withText  → reservado para compatibilidad (la imagen ya incluye el texto)
 *   style, className
 */
export default function LogoCoop({
  size = 100,
  withText = false,
  style = {},
  className = "",
}) {
  return (
    <img
      src="/smartcoop.png"
      alt="Smart Coop"
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
