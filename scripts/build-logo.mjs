import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const asset = (name) =>
  readFile(new URL(`../vendor/nexofolio-elastic/assets/${name}`, import.meta.url))
const [model, matcap, timeline] = await Promise.all([
  asset('nexofolio-elastic.glb'),
  asset('black-matcap.png'),
  asset('intro-timeline.json'),
])
await build({
  absWorkingDir: root,
  entryPoints: ['vendor/nexofolio-elastic/elastic-source.js'],
  outfile: 'public/nexofolio/nexofolio-elastic.mjs',
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'eof',
  define: {
    __MODEL_BASE64__: JSON.stringify(model.toString('base64')),
    __MATCAP__: JSON.stringify(matcap.toString('base64')),
    __TIMELINE__: timeline.toString(),
  },
})
