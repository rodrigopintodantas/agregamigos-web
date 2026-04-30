import { Component } from '@angular/core';
import { PrincipalCabecalho } from './components/principal-cabecalho';

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [PrincipalCabecalho],
  styles: [`
    :host {
      display: grid;
      place-items: center;
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      min-height: 100svh;
      background: var(--color-brand-gradient-shell);
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      padding-left: max(0.75rem, env(safe-area-inset-left, 0px));
      padding-right: max(0.75rem, env(safe-area-inset-right, 0px));
      box-sizing: border-box;
    }

    .principal-screen {
      width: min(400px, 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8rem;
      margin: auto;
    }
  `],
  template: `
    <div class="principal-screen">
      <div class="app-login-card">
        <principal-cabecalho></principal-cabecalho>
      </div>
    </div>
  `
})
export class PrincipalComponent {}
