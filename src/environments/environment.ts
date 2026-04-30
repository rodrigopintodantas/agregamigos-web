/**
 * Desenvolvimento (`ng serve` / `ng build` sem `--configuration production`).
 * Produção usa `environment.prod.ts` via `angular.json` → `fileReplacements`.
 */
export const environment = {
  production: false,
  apiUrl: '/api'
};
