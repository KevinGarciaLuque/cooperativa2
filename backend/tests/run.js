// Ejecuta todas las pruebas con el ejecutor integrado de Node (sin dependencias).
// Uso: npm test            (todo)
//      npm run test:unit   (solo cálculos, sin base de datos)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const soloUnitarias = process.argv.includes("--unit");
const raiz = __dirname;

const listar = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => path.join(dir, f))
    : [];

const archivos = [...listar(path.join(raiz, "unit")), ...(soloUnitarias ? [] : listar(path.join(raiz, "integracion")))];

const r = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", "--test-force-exit", ...archivos],
  { stdio: "inherit" }
);
process.exit(r.status === null ? 1 : r.status);
