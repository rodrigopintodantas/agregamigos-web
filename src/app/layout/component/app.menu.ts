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
      <li *ngIf="auth.isAdmin() && isAdminLogin()">
        <a
          routerLink="/admin/modelos-mensagem"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Modelos de mensagem' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <path d="M14 2v6h6"></path>
              <path d="M8 13h8"></path>
              <path d="M8 17h5"></path>
            </svg>
          </span>
          <span class="menu-label">Modelos de mensagem</span>
        </a>
      </li>
      <li *ngIf="auth.isAdmin()">
        <a
          routerLink="/admin/criar-usuario"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Criar usuário' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"></path>
            </svg>
          </span>
          <span class="menu-label">Criar usuário</span>
        </a>
      </li>
      <li *ngIf="auth.isAdmin() && isAdminLogin()">
        <a
          routerLink="/admin/whatsapp"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Conexão WhatsApp' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 2a10 10 0 0 0-8.62 15.07L2 22l5.08-1.33A10 10 0 1 0 12 2zm0 18a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-3.02.79.8-2.95-.19-.3A8 8 0 1 1 12 20z"
              ></path>
              <path d="M16.5 14.27c-.25-.12-1.48-.73-1.7-.81s-.38-.12-.54.12-.62.81-.76.97-.29.18-.54.06a6.46 6.46 0 0 1-1.9-1.17 7.1 7.1 0 0 1-1.3-1.62c-.14-.24 0-.37.1-.49.11-.11.25-.29.37-.44a1.7 1.7 0 0 0 .25-.42.47.47 0 0 0-.02-.44c-.06-.12-.54-1.3-.74-1.78-.19-.46-.38-.4-.54-.4h-.46a.88.88 0 0 0-.64.3 2.67 2.67 0 0 0-.84 1.98 4.68 4.68 0 0 0 .98 2.47 10.7 10.7 0 0 0 4.09 3.62c.58.25 1.03.4 1.38.52a3.3 3.3 0 0 0 1.5.09 2.44 2.44 0 0 0 1.6-1.12 1.95 1.95 0 0 0 .14-1.12c-.06-.1-.22-.16-.47-.28z"></path>
            </svg>
          </span>
          <span class="menu-label">Conexão WhatsApp</span>
        </a>
      </li>
      <li *ngIf="auth.isAdmin() && isAdminLogin()">
        <a
          routerLink="/admin/divulgacao"
          routerLinkActive="active-route"
          [attr.title]="ui.sidebarCollapsed() ? 'Divulgação' : null"
          (click)="ui.closeMobileMenu()"
        >
          <span class="menu-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M2 10v4a2 2 0 0 0 2 2h3l5 4V4L7 8H4a2 2 0 0 0-2 2z"></path>
              <path d="M16 9a4 4 0 0 1 0 6"></path>
              <path d="M19 6a8 8 0 0 1 0 12"></path>
            </svg>
          </span>
          <span class="menu-label">Divulgação</span>
        </a>
      </li>
    </ul>
  `
})
export class AppMenu {
  auth = inject(AutenticacaoService);
  ui = inject(LayoutUiService);

  isAdminLogin(): boolean {
    return (this.auth.getUserLogin() ?? '').trim().toLowerCase() === 'admin';
  }
}

