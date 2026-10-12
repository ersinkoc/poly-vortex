import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const site = resolve(import.meta.dir, '../out');
const required = ['index.html', 'hangar/index.html', '404.html', 'CNAME', '.nojekyll'];
for (const path of required) await access(resolve(site, path));
const cname = (await Bun.file(resolve(site, 'CNAME')).text()).trim();
if (cname !== 'poly-vortex.oxog.dev') throw new Error(`Unexpected custom domain: ${cname}`);
for (const route of ['index.html', 'hangar/index.html']) {
  const html = await Bun.file(resolve(site, route)).text();
  const files = [...html.matchAll(/(?:src|href)="(\/_next\/[^"?]+)(?:\?[^"\s]*)?"/g)].map(match => match[1]);
  if (!files.length) throw new Error(`No static Next.js assets found in ${route}`);
  for (const path of files) await access(resolve(site, `.${path}`));
}
console.log('Static export verified: game, drydock, 404, local assets, .nojekyll, and poly-vortex.oxog.dev CNAME.');
