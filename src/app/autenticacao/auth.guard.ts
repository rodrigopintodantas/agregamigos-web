import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AutenticacaoService } from '../service/autenticacao.service';

const isAccessAllowed = async (route: ActivatedRouteSnapshot, _: RouterStateSnapshot): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const auth = inject(AutenticacaoService);

  if (!auth.authenticated || !auth.temPerfil()) {
    return router.createUrlTree(['/']);
  }

  const perfil = auth.getPerfil();
  const roles = (route.data?.['roles'] as string[] | undefined) ?? [];
  if (roles.length && (!perfil?.nome || !roles.includes(perfil.nome))) {
    return router.createUrlTree(['/nao-encontrado']);
  }

  return true;
};

export const canActivateAuthRole: CanActivateFn = isAccessAllowed;
