import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { AppBarraLateral } from './app.barra-lateral';
import { AppBarraSuperior } from './app.barra-superior';
import { AppBottomNav } from './app.bottom-nav';
import { AppRodape } from './app.rodape';
import { LayoutUiService } from '../service/layout-ui.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppBarraSuperior, AppBarraLateral, AppRodape, AppBottomNav],
  template: `
    <div
      class="layout-wrapper"
      [class.sidebar-collapsed]="ui.sidebarCollapsed()"
      [class.mobile-menu-open]="ui.mobileMenuOpen()"
      [class.native-bottom-nav]="showNativeBottomNav()"
    >
      <app-barra-superior></app-barra-superior>
      <div class="layout-content">
        <app-barra-lateral></app-barra-lateral>
        <main class="layout-main">
          <div class="layout-page-content">
            <router-outlet></router-outlet>
          </div>
          <app-rodape></app-rodape>
        </main>
      </div>
      <button
        type="button"
        class="layout-mask"
        [class.visible]="ui.mobileMenuOpen()"
        (click)="ui.closeMobileMenu()"
        aria-label="Fechar menu"
      ></button>
      <app-bottom-nav *ngIf="showNativeBottomNav()"></app-bottom-nav>
    </div>
  `
})
export class AppLayout {
  ui = inject(LayoutUiService);
  auth = inject(AutenticacaoService);

  showNativeBottomNav(): boolean {
    return Capacitor.isNativePlatform() && !!this.auth.getAccessToken();
  }
}
