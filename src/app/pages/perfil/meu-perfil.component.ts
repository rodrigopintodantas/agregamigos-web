import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';

@Component({
  selector: 'app-meu-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meu-perfil.component.html',
  styleUrls: ['./meu-perfil.component.scss', '../admin/dashboard/admin.dashboard.component.scss']
})
export class MeuPerfilComponent implements OnInit {
  auth = inject(AutenticacaoService);

  carregando = true;
  erro = '';

  dialogSenhaAberto = false;
  senhaAtual = '';
  senhaNova = '';
  senhaNovaRepetir = '';
  salvandoSenha = false;
  erroSenha = '';
  sucessoSenha = '';

  ngOnInit() {
    this.auth.carregarPerfil().subscribe({
      next: () => {
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível atualizar os dados do servidor. Exibindo informações salvas na sessão.';
      }
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
      }
    });
  }
}
