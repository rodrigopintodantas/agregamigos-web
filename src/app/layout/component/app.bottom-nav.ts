import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';

type BottomNavItem = {
  label: string;
  route: string;
  exact?: boolean;
  iconPath: string;
};

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bottom-nav" aria-label="Navegação principal do app">
      <a
        *ngFor="let item of items()"
        class="bottom-nav-item"
        [routerLink]="item.route"
        routerLinkActive="active-route"
        [routerLinkActiveOptions]="{ exact: !!item.exact }"
      >
        <span class="bottom-nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path [attr.d]="item.iconPath"></path>
          </svg>
        </span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </a>
    </nav>
  `,
})
export class AppBottomNav {
  private auth = inject(AutenticacaoService);

  private iconHome = 'M3 10.5L12 3l9 7.5v10.5h-6.5V14h-5v7H3V10.5z';

  private iconPessoas =
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm12-1h-4M16 5h6M19 8h-6';

  items = computed((): BottomNavItem[] => {
    const slug = this.auth.getCandidatoSlug();
    if (!slug) {
      return [{ label: 'Início', route: '/selecionar-candidato', exact: true, iconPath: this.iconHome }];
    }
    const base = `/${slug}`;
    if (this.auth.isAdmin()) {
      return [{ label: 'Dashboard', route: `${base}/admin`, exact: true, iconPath: this.iconHome }];
    }
    if (this.auth.isCoordenador()) {
      return [
        { label: 'Painel', route: `${base}/coordenador`, exact: true, iconPath: this.iconHome },
        { label: 'Pessoas', route: `${base}/coordenador/pessoas`, exact: false, iconPath: this.iconPessoas },
      ];
    }
    return [{ label: 'Dashboard', route: `${base}/home`, exact: true, iconPath: this.iconHome }];
  });
}
