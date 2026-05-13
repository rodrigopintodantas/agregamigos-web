import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AutenticacaoService } from '../service/autenticacao.service';

/** Garante que a URL `/:candidatoSlug/...` corresponde ao candidato ativo no token/sessão. */
export const canActivateCandidatoSlug: CanActivateFn = (route): boolean | UrlTree => {
  const router = inject(Router);
  const auth = inject(AutenticacaoService);
  const slugParam = String(route.paramMap.get('candidatoSlug') ?? '')
    .trim()
    .toLowerCase();

  if (!auth.authenticated || !auth.temPerfil()) {
    return router.createUrlTree(['/']);
  }

  const slugAtivo = auth.getCandidatoSlug();
  if (!slugAtivo) {
    return router.createUrlTree(['/selecionar-candidato']);
  }

  if (slugParam !== slugAtivo) {
    const path = router.url.split('?')[0];
    const parts = path.split('/').filter((p) => p.length > 0);
    if (parts.length) {
      parts[0] = slugAtivo;
    } else {
      parts.push(slugAtivo, auth.areaLogadaSegmento());
    }
    return router.createUrlTree(parts);
  }

  return true;
};
