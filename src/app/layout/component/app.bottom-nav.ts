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

  private usuarioItems: BottomNavItem[] = [
    {
      label: 'Dashboard',
      route: '/home',
      exact: true,
      iconPath: 'M3 10.5L12 3l9 7.5v10.5h-6.5V14h-5v7H3V10.5z',
    },
  ];

  private adminItems: BottomNavItem[] = [
    {
      label: 'Dashboard',
      route: '/admin',
      exact: true,
      iconPath: 'M3 10.5L12 3l9 7.5v10.5h-6.5V14h-5v7H3V10.5z',
    },
  ];

  items = computed(() => (this.auth.isAdmin() ? this.adminItems : this.usuarioItems));
}
