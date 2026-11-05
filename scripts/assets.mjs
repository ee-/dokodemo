import { copyFile, mkdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
for (const [name, directory, files] of [
  ['scramjet', 'scramjet', ['scramjet.js', 'scramjet.wasm']],
  ['scramjet-controller', 'controller', ['controller.api.js', 'controller.inject.js', 'controller.sw.js']],
  ['libcurl-transport', 'libcurl', ['index.mjs']],
]) {
  const destination = new URL(`public/${directory}/`, root)
  await mkdir(destination, { recursive: true })
  for (const file of files) {
    await copyFile(
      new URL(`node_modules/@mercuryworkshop/${name}/dist/${file}`, root),
      new URL(file, destination),
    )
  }
}

await copyFile(
  new URL('node_modules/@mercuryworkshop/libcurl-transport/LICENSE', root),
  new URL('public/libcurl/LICENSE', root),
)
