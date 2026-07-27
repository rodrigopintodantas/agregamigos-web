import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { UsuarioListagemItem, UsuarioService } from '../../service/usuario.service';

@Component({
  selector: 'app-meu-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meu-perfil.component.html',
  styleUrls: ['./meu-perfil.component.scss', '../admin/dashboard/admin.dashboard.component.scss'],
})
export class MeuPerfilComponent implements OnInit {
  auth = inject(AutenticacaoService);
  private usuarioService = inject(UsuarioService);

  carregando = true;
  erro = '';

  dialogSenhaAberto = false;
  senhaAtual = '';
  senhaNova = '';
  senhaNovaRepetir = '';
  salvandoSenha = false;
  erroSenha = '';
  sucessoSenha = '';

  usuariosReinicio: UsuarioListagemItem[] = [];
  carregandoUsuariosReinicio = false;
  usuarioReinicioId: number | null = null;
  reiniciandoSenha = false;
  erroReinicio = '';
  sucessoReinicio = '';

  ngOnInit() {
    this.auth.carregarPerfil().subscribe({
      next: () => {
        this.carregando = false;
        if (this.auth.isLoginAdminSistema()) {
          this.carregarUsuariosReinicio();
        }
      },
      error: () => {
        this.carregando = false;
        this.erro =
          'Não foi possível atualizar os dados do servidor. Exibindo informações salvas na sessão.';
        if (this.auth.isLoginAdminSistema()) {
          this.carregarUsuariosReinicio();
        }
      },
    });
  }

  carregarUsuariosReinicio(): void {
    this.carregandoUsuariosReinicio = true;
    this.erroReinicio = '';
    this.usuarioService.listar().subscribe({
      next: (lista) => {
        this.usuariosReinicio = lista;
        this.carregandoUsuariosReinicio = false;
      },
      error: (err) => {
        this.carregandoUsuariosReinicio = false;
        this.usuariosReinicio = [];
        this.erroReinicio = err?.error?.message ?? 'Não foi possível carregar os usuários.';
      },
    });
  }

  confirmarReiniciarSenhaUsuario(): void {
    if (!this.auth.isLoginAdminSistema() || this.reiniciandoSenha) return;
    const id = Number(this.usuarioReinicioId);
    if (!Number.isInteger(id) || id <= 0) {
      this.erroReinicio = 'Selecione um usuário.';
      this.sucessoReinicio = '';
      return;
    }

    const alvo = this.usuariosReinicio.find((u) => u.id === id);
    const rotulo = alvo ? `${alvo.nome} (${alvo.login})` : `usuário #${id}`;
    const ok = window.confirm(
      `Reiniciar a senha de ${rotulo} para 123456?\n\nO usuário poderá entrar com essa senha e alterá-la depois.`,
    );
    if (!ok) return;

    this.reiniciandoSenha = true;
    this.erroReinicio = '';
    this.sucessoReinicio = '';
    this.usuarioService.reiniciarSenha(id).subscribe({
      next: (resp) => {
        this.reiniciandoSenha = false;
        this.sucessoReinicio = resp.message ?? 'Senha reiniciada para 123456.';
      },
      error: (err) => {
        this.reiniciandoSenha = false;
        this.erroReinicio = err?.error?.message ?? 'Não foi possível reiniciar a senha.';
      },
    });
  }

  textoOuTraco(v: string | number | null | undefined): string {
    if (v === null || v === undefined) {
      return '—';
    }
    const s = String(v).trim();
    return s.length ? s : '—';
  }

  abrirDialogSenha(): void {
    this.dialogSenhaAberto = true;
    this.senhaAtual = '';
    this.senhaNova = '';
    this.senhaNovaRepetir = '';
    this.erroSenha = '';
    this.sucessoSenha = '';
  }

  fecharDialogSenha(): void {
    this.dialogSenhaAberto = false;
  }

  podeConfirmarSenha(): boolean {
    return this.senhaNova.length > 0 && this.senhaNova === this.senhaNovaRepetir;
  }

  confirmarAlterarSenha(): void {
    if (!this.podeConfirmarSenha() || this.salvandoSenha) {
      return;
    }
    this.salvandoSenha = true;
    this.erroSenha = '';
    this.sucessoSenha = '';
    this.auth.alterarSenha(this.senhaAtual, this.senhaNova, this.senhaNovaRepetir).subscribe({
      next: () => {
        this.salvandoSenha = false;
        this.sucessoSenha = 'Senha alterada com sucesso.';
        this.senhaAtual = '';
        this.senhaNova = '';
        this.senhaNovaRepetir = '';
        setTimeout(() => {
          this.fecharDialogSenha();
          this.sucessoSenha = '';
        }, 1200);
      },
      error: (err) => {
        this.salvandoSenha = false;
        this.erroSenha = err?.error?.message ?? 'Não foi possível alterar a senha.';
      },
    });
  }
}
