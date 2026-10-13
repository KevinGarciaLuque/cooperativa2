import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cada compilación lleva un número de versión. La app lo compara con /version.json para
// saber si se publicó una versión nueva mientras la pestaña seguía abierta.
const VERSION = new Date().toISOString().replace(/\D/g, '').slice(0, 14)

const archivoVersion = () => ({
  name: 'archivo-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), archivoVersion()],
  define: { __VERSION__: JSON.stringify(VERSION) },
})
