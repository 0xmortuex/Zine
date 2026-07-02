// Post-build step for static hosts without SPA rewrite rules (GitHub
// Pages): serve a copy of index.html as 404.html so deep links like
// /manga/:id boot the app instead of the host's 404 page, and drop
// .nojekyll so Pages doesn't route the artifact through Jekyll.
import { copyFileSync, writeFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
console.log('pages postbuild: wrote dist/404.html and dist/.nojekyll')
