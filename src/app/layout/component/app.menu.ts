import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { LayoutUiService } from '../service/layout-ui.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <ul class="menu-list">
      <li class="menu-section">Menu</li>
      <li>
        <a
          [routerLink]="auth.isAdmin() ? '/admin' : '/home'"
          routerLinkActive="active-route"
          [routerLinkActiveOptions]="{ exact: true }"
          [attr.title]="ui.sidebarCollapsed() ? 'Dashboard' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 10.5L12 3l9 7.5v10.5h-6.5V14h-5v7H3V10.5z"></path>
            </svg>
          </span>
          <span class="menu-label">Dashboard</span>
        </a>
      </li>
      <li>
        <a
          [routerLink]="auth.isAdmin() ? '/admin/pessoas' : '/home/pessoas'"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Pessoas' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"></path>
              <path d="M8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z"></path>
              <path d="M8 13c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"></path>
              <path d="M16 13c-.29 0-.62.02-.97.05C16.69 13.9 18 15.19 18 17v3h6v-3c0-2.66-5.33-4-8-4z"></path>
            </svg>
          </span>
          <span class="menu-label">Pessoas</span>
        </a>
      </li>
      <li *ngIf="auth.isAdmin()">
        <a
          routerLink="/perfil"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Meu Perfil' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"></path>
            </svg>
          </span>
          <span class="menu-label">Meu Perfil</span>
        </a>
      </li>
    </ul>
  `
})
export class AppMenu {
  auth = inject(AutenticacaoService);
  ui = inject(LayoutUiService);
}

