import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacaoService } from '../../../service/autenticacao.service';

@Component({
  selector: 'principal-cabecalho',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="principal-header mobile-auth-header">
      <div class="login-area">
        <label class="input-label" for="login">Login ou email</label>
        <input
          id="login"
          [(ngModel)]="loginInput"
          type="text"
          name="login"
          autocomplete="username"
          placeholder="Digite seu login ou email"
        />
        <label class="input-label" for="senha">Senha</label>
        <input
          id="senha"
          [(ngModel)]="senhaInput"
          type="password"
          name="senha"
          autocomplete="current-password"
          placeholder="Sua senha"
          (keyup.enter)="fazerLogin()"
        />
        <button
          type="button"
          (click)="fazerLogin()"
          [disabled]="!loginInput.trim() || !senhaInput.length || carregando"
        >
          {{ carregando ? 'Entrando…' : 'Entrar' }}
        </button>
      </div>
    </header>

    <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
  `
})
export class PrincipalCabecalho {
  auth = inject(AutenticacaoService);
  router = inject(Router);

  loginInput = '';
  senhaInput = '';
  errorMessage = '';
  carregando = false;

  ngOnInit() {
    const token = this.auth.getAccessToken();
    const perfil = this.auth.getPerfil();
    if (token && perfil?.dashboard) {
      void this.router.navigate([perfil.dashboard]);
      return;
    }
    if (token && !perfil) {
      void this.router.navigate(['/home']);
    }
  }

  fazerLogin() {
    this.errorMessage = '';
    const login = this.loginInput.trim();
    if (!login || !this.senhaInput.length) {
      this.errorMessage = 'Informe login ou email e senha.';
      return;
    }

    this.carregando = true;
    this.auth.autenticar(login, this.senhaInput).subscribe({
      next: (retorno) => {
        this.carregando = false;
        const dashboard = retorno.papeis[0]?.dashboard || '/home';
        void this.router.navigate([dashboard]);
      },
      error: (err) => {
        this.carregando = false;
        this.errorMessage = err?.error?.message ?? 'Não foi possível entrar. Verifique login/email e senha.';
      }
    });
  }
}
