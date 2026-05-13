import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AutenticacaoService } from '../service/autenticacao.service';

/** Exige login e perfil (sem checar papel específico). */
export const canActivateUsuarioLogado: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const auth = inject(AutenticacaoService);
  if (!auth.authenticated || !auth.temPerfil()) {
    return router.createUrlTree(['/']);
  }
  return true;
};
