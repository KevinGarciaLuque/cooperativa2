// Reduce las fotos del celular (suelen pesar varios MB) antes de subirlas.
// Los archivos que no son imagen se devuelven sin cambios.
export const comprimirImagen = (archivo, maximo = 1600, calidad = 0.82) =>
  new Promise((resolver) => {
    if (!archivo.type || !archivo.type.startsWith("image/") || archivo.type === "image/gif" || archivo.type === "image/svg+xml") {
      return resolver(archivo);
    }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
      lienzo.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          // Si la versión reducida no es más liviana, se conserva la original
          if (!blob || blob.size >= archivo.size) return resolver(archivo);
          resolver(new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        calidad
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolver(archivo);
    };
    img.src = url;
  });
