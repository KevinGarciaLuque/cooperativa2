// Copia de cada respaldo fuera del servidor, en un almacenamiento compatible con S3
// (Cloudflare R2, Amazon S3, Backblaze B2, DigitalOcean Spaces...). El disco de Railway se
// borra en cada despliegue: sin esta copia, los respaldos guardados en el servidor se pierden.
//
// Se activa con variables de entorno (nunca en el código ni en el repositorio):
//   RESPALDO_S3_BUCKET       nombre del bucket
//   RESPALDO_S3_ACCESS_KEY   clave de acceso
//   RESPALDO_S3_SECRET_KEY   clave secreta
//   RESPALDO_S3_ENDPOINT     URL del servicio (R2: https://<cuenta>.r2.cloudflarestorage.com).
//                            Sin ella se usa Amazon S3 de la región indicada.
//   RESPALDO_S3_REGION       región (R2: "auto"; Amazon: por ejemplo "us-east-1")
//   RESPALDO_S3_PREFIJO      carpeta dentro del bucket (por defecto "respaldos/")
const crypto = require("crypto");
const zlib = require("zlib");

const cfg = () => {
  const region = process.env.RESPALDO_S3_REGION || "auto";
  return {
    bucket: process.env.RESPALDO_S3_BUCKET || "",
    accessKey: process.env.RESPALDO_S3_ACCESS_KEY || "",
    secretKey: process.env.RESPALDO_S3_SECRET_KEY || "",
    region,
    endpoint: (
      process.env.RESPALDO_S3_ENDPOINT ||
      `https://s3.${region === "auto" ? "us-east-1" : region}.amazonaws.com`
    ).replace(/\/+$/, ""),
    prefijo: (process.env.RESPALDO_S3_PREFIJO ?? "respaldos/").replace(/^\/+/, ""),
  };
};

const configurado = () => {
  const c = cfg();
  return Boolean(c.bucket && c.accessKey && c.secretKey);
};

const sha256 = (datos) => crypto.createHash("sha256").update(datos).digest("hex");
const hmac = (clave, datos) => crypto.createHmac("sha256", clave).update(datos).digest();

// Cada segmento de la ruta codificado como pide S3 (RFC 3986)
const codificarRuta = (ruta) =>
  ruta
    .split("/")
    .map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");

// Firma AWS Signature Version 4 (encabezados). Devuelve los encabezados a enviar.
const firmar = ({ metodo, url, encabezados, hashCuerpo, region, accessKey, secretKey, fecha = new Date() }) => {
  const u = new URL(url);
  const amzFecha = fecha.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
  const dia = amzFecha.slice(0, 8);
  const todos = { ...encabezados, host: u.host, "x-amz-date": amzFecha, "x-amz-content-sha256": hashCuerpo };
  const nombres = Object.keys(todos).map((k) => k.toLowerCase()).sort();
  const valores = Object.fromEntries(Object.entries(todos).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const firmados = nombres.join(";");
  const consulta = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonica = [
    metodo,
    codificarRuta(decodeURIComponent(u.pathname)),
    consulta,
    nombres.map((n) => `${n}:${valores[n]}\n`).join(""),
    firmados,
    hashCuerpo,
  ].join("\n");
  const alcance = `${dia}/${region}/s3/aws4_request`;
  const aFirmar = ["AWS4-HMAC-SHA256", amzFecha, alcance, sha256(canonica)].join("\n");
  const clave = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dia), region), "s3"), "aws4_request");
  const firma = crypto.createHmac("sha256", clave).update(aFirmar).digest("hex");
  return {
    ...todos,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${alcance}, SignedHeaders=${firmados}, Signature=${firma}`,
  };
};

// Sube el respaldo comprimido (.sql.gz). Devuelve { nombre, bytes } o lanza un error claro.
const subirRespaldo = async (nombreArchivo, contenidoSql) => {
  if (!configurado()) throw new Error("El almacenamiento externo de respaldos no está configurado.");
  const c = cfg();
  const cuerpo = zlib.gzipSync(Buffer.from(contenidoSql, "utf8"));
  const nombre = `${c.prefijo}${nombreArchivo}.gz`;
  const url = `${c.endpoint}/${codificarRuta(c.bucket)}/${codificarRuta(nombre)}`;
  const encabezados = firmar({
    metodo: "PUT",
    url,
    encabezados: { "content-type": "application/gzip" },
    hashCuerpo: sha256(cuerpo),
    region: c.region,
    accessKey: c.accessKey,
    secretKey: c.secretKey,
  });
  delete encabezados.host; // lo pone fetch
  const r = await fetch(url, { method: "PUT", headers: encabezados, body: cuerpo });
  if (!r.ok) {
    const detalle = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`El almacenamiento externo respondió ${r.status}. ${detalle}`.trim());
  }
  return { nombre, bytes: cuerpo.length };
};

module.exports = { configurado, subirRespaldo, firmar, cfg };
