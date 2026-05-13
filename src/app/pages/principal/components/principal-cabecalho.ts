import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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
  `,
})
export class PrincipalCabecalho implements OnInit {
  auth = inject(AutenticacaoService);
  router = inject(Router);

  loginInput = '';
  senhaInput = '';
  errorMessage = '';
  carregando = false;

  ngOnInit() {
    const token = this.auth.getAccessToken();
    const perfil = this.auth.getPerfil();
    if (token && perfil?.nome && this.auth.temCandidatoSelecionado()) {
      const dash = this.auth.areaLogadaSegmento();
      void this.router.navigateByUrl(this.auth.rotaComCandidato(dash));
      return;
    }
    if (token && perfil && !this.auth.temCandidatoSelecionado()) {
      void this.router.navigate(['/selecionar-candidato']);
      return;
    }
    if (token && !perfil) {
      void this.router.navigate(['/selecionar-candidato']);
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
        const candidatos = retorno.candidatos ?? [];
        if (candidatos.length === 0) {
          this.carregando = false;
          this.errorMessage = 'Nenhum candidato vinculado ao seu usuário. Contate o administrador.';
          return;
        }
        if (candidatos.length === 1) {
          this.auth.selecionarCandidato(candidatos[0].slug).subscribe({
            next: (sel) => {
              this.carregando = false;
              const dash = this.auth.areaLogadaSegmento();
              void this.router.navigateByUrl(`/${sel.candidato.slug}/${dash}`);
            },
            error: (err) => {
              this.carregando = false;
              this.errorMessage = err?.error?.message ?? 'Não foi possível definir o candidato.';
            },
          });
          return;
        }
        this.carregando = false;
        void this.router.navigate(['/selecionar-candidato']);
      },
      error: (err) => {
        this.carregando = false;
        this.errorMessage = err?.error?.message ?? 'Não foi possível entrar. Verifique login/email e senha.';
      },
    });
  }
}
