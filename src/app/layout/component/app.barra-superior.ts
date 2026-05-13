import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { LayoutUiService } from '../service/layout-ui.service';

@Component({
  selector: 'app-barra-superior',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" class="icon-button" (click)="toggleMenu()" aria-label="Abrir menu">
          <span class="hamburger-icon" aria-hidden="true"></span>
        </button>
      </div>
      <div class="user-info">
        <span>{{ auth.getUsuario().nome || auth.getUserLogin() }}</span>
        <small>{{ auth.getPerfil()?.nome }}</small>
        <div class="user-menu-wrap" #userMenuWrap>
          <button
            type="button"
            class="icon-button user-menu-trigger"
            (click)="toggleMenuUsuario($event)"
            [attr.aria-expanded]="menuUsuarioAberto"
            aria-haspopup="true"
            aria-label="Menu do usuário"
          >
            <svg
              class="user-menu-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          <div class="user-menu-dropdown" *ngIf="menuUsuarioAberto" role="menu" aria-label="Conta">
            <button type="button" class="user-menu-item" role="menuitem" (click)="trocarCandidato()">Trocar candidato</button>
            <button type="button" class="user-menu-item" role="menuitem" (click)="irMeuPerfil()">Meu Perfil</button>
            <button type="button" class="user-menu-item" role="menuitem" (click)="sair()">Sair</button>
          </div>
        </div>
      </div>
    </header>
  `
})
export class AppBarraSuperior {
  @ViewChild('userMenuWrap', { read: ElementRef }) userMenuWrap?: ElementRef<HTMLElement>;

  auth = inject(AutenticacaoService);
  router = inject(Router);
  ui = inject(LayoutUiService);

  menuUsuarioAberto = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.menuUsuarioAberto) {
      return;
    }
    const root = this.userMenuWrap?.nativeElement;
    if (root?.contains(ev.target as Node)) {
      return;
    }
    this.menuUsuarioAberto = false;
  }

  toggleMenuUsuario(ev: MouseEvent) {
    ev.stopPropagation();
    this.menuUsuarioAberto = !this.menuUsuarioAberto;
  }

  irMeuPerfil() {
    this.menuUsuarioAberto = false;
    void this.router.navigateByUrl(this.auth.rotaComCandidato('perfil'));
  }

  trocarCandidato() {
    this.menuUsuarioAberto = false;
    void this.router.navigate(['/selecionar-candidato']);
  }

  sair() {
    this.menuUsuarioAberto = false;
    this.auth.logout();
    this.router.navigate(['/']);
  }

  toggleMenu() {
    if (window.innerWidth <= 992) {
      this.ui.toggleMobileMenu();
      return;
    }
    this.ui.toggleSidebarCollapsed();
  }
}
