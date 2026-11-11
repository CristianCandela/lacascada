// arreglo_base.mjs — unifica el nombre de la sede principal: 'Año Nuevo' -> 'Túpac Amaru' en el simulador y en las pruebas
// (la app ya usa SEDES = ['Túpac Amaru', 'Santa Rosa']). Ejecutar en la RAÍZ del repo. Repetible.
import fs from 'node:fs';
const archivos = ['web/src/mock/supabase-mock.js', 'web/tests/e2e.mjs', 'web/tests/logica.test.js'];
let cambios = 0;
for (const f of archivos) {
  if (!fs.existsSync(f)) { console.error('ERROR: no existe ' + f); process.exit(1); }
  const t = fs.readFileSync(f, 'utf8');
  const n = t.split('Año Nuevo').join('Túpac Amaru');
  if (n !== t) { fs.writeFileSync(f, n); cambios++; console.log('Corregido: ' + f); }
}
console.log(cambios ? 'Listo.' : 'Ya estaba aplicado.');
