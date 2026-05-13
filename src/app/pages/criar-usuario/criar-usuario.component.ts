import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { PapelItem, UsuarioService } from '../../service/usuario.service';

@Component({
  selector: 'app-criar-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './criar-usuario.component.html',
  styleUrl: './criar-usuario.component.scss',
})
export class CriarUsuarioComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private auth = inject(AutenticacaoService);

  carregandoPapeis = true;
  salvando = false;
  erro = '';
  sucesso = '';
  papeis: PapelItem[] = [];

  form = {
    nome: '',
    login: '',
    email: '',
    senha: '',
    papel_id: null as number | null,
  };

  ngOnInit(): void {
    this.carregarPapeis();
  }

  get papeisSelecionaveis(): PapelItem[] {
    if (this.auth.isLoginAdminSistema()) return this.papeis;
    return this.papeis.filter((p) => p.nome !== 'Administrador');
  }

  carregarPapeis(): void {
    this.carregandoPapeis = true;
    this.usuarioService.listarPapeis().subscribe({
      next: (papeis) => {
        this.papeis = papeis;
        const lista = this.papeisSelecionaveis;
        const papelPadrao = lista.find((p) => p.nome === 'Usuario') ?? lista[0] ?? null;
        this.form.papel_id = papelPadrao?.id ?? null;
        this.carregandoPapeis = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os perfis.';
        this.carregandoPapeis = false;
      },
    });
  }

  salvar(): void {
    this.erro = '';
    this.sucesso = '';

    if (this.form.nome.trim().length < 3) {
      this.erro = 'Informe nome com pelo menos 3 caracteres.';
      return;
    }
    if (this.form.login.trim().length < 3) {
      this.erro = 'Informe login com pelo menos 3 caracteres.';
      return;
    }
    if (this.form.senha.length < 6) {
      this.erro = 'Informe senha com pelo menos 6 caracteres.';
      return;
    }
    if (this.form.papel_id == null) {
      this.erro = 'Selecione um perfil.';
      return;
    }
    const papelEscolhido = this.papeis.find((p) => p.id === this.form.papel_id);
    if (papelEscolhido?.nome === 'Administrador' && !this.auth.isLoginAdminSistema()) {
      this.erro = 'Apenas o usuário admin pode criar outro administrador.';
      return;
    }

    this.salvando = true;
    this.usuarioService
      .criar({
        nome: this.form.nome.trim(),
        login: this.form.login.trim(),
        email: this.form.email.trim() || null,
        senha: this.form.senha,
        papel_id: this.form.papel_id,
      })
      .subscribe({
        next: () => {
          this.salvando = false;
          this.sucesso = 'Usuário criado com sucesso.';
          this.form.nome = '';
          this.form.login = '';
          this.form.email = '';
          this.form.senha = '';
          const lista = this.papeisSelecionaveis;
          const papelPadrao = lista.find((p) => p.nome === 'Usuario') ?? lista[0] ?? null;
          this.form.papel_id = papelPadrao?.id ?? null;
        },
        error: (err) => {
          this.salvando = false;
          this.erro = err?.error?.message ?? 'Não foi possível criar o usuário.';
        },
      });
  }
}
