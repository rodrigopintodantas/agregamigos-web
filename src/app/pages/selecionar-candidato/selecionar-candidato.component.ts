import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { CandidatoService, CriarCandidatoPayload } from '../../service/candidato.service';
import { CandidatoResumo } from '../../types/candidato.model';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-selecionar-candidato',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selecionar-candidato.component.html',
  styleUrl: './selecionar-candidato.component.scss',
})
export class SelecionarCandidatoComponent implements OnInit {
  private auth = inject(AutenticacaoService);
  private router = inject(Router);
  private candidatoApi = inject(CandidatoService);

  candidatos: CandidatoResumo[] = [];
  carregando = true;
  erro = '';
  selecionandoSlug: string | null = null;

  dialogAberto = false;
  formNovoNome = '';
  formNovoSlug = '';
  dialogErro = '';
  salvandoNovo = false;

  ngOnInit(): void {
    this.recarregarLista();
  }

  isUsuarioAdminLogin(): boolean {
    return (this.auth.getUserLogin() ?? '').trim().toLowerCase() === 'admin';
  }

  abrirDialogNovo(): void {
    this.dialogErro = '';
    this.formNovoNome = '';
    this.formNovoSlug = '';
    this.dialogAberto = true;
  }

  fecharDialog(): void {
    if (this.salvandoNovo) return;
    this.dialogAberto = false;
    this.dialogErro = '';
  }

  sugerirSlugAPartirDoNome(): void {
    const base = this.formNovoNome.trim();
    if (!base) return;
    const s = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
    this.formNovoSlug = s.slice(0, 80);
  }

  salvarNovoCandidato(): void {
    this.dialogErro = '';
    const nome = this.formNovoNome.trim();
    const slug = this.formNovoSlug.trim().toLowerCase();

    if (nome.length < 2) {
      this.dialogErro = 'Informe o nome com pelo menos 2 caracteres.';
      return;
    }
    if (nome.length > 160) {
      this.dialogErro = 'Nome muito longo (máximo 160 caracteres).';
      return;
    }
    if (!slug) {
      this.dialogErro = 'Informe o slug (identificador na URL).';
      return;
    }
    if (!SLUG_REGEX.test(slug)) {
      this.dialogErro =
        'Slug inválido: use apenas letras minúsculas, números e hífens, sem começar ou terminar com hífen.';
      return;
    }

    const payload: CriarCandidatoPayload = { nome, slug };
    this.salvandoNovo = true;
    this.candidatoApi.criar(payload).subscribe({
      next: (ret) => {
        this.salvandoNovo = false;
        this.candidatos = [...this.candidatos, ret.candidato].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt'),
        );
        this.dialogAberto = false;
        this.formNovoNome = '';
        this.formNovoSlug = '';
      },
      error: (err) => {
        this.salvandoNovo = false;
        this.dialogErro = err?.error?.message ?? 'Não foi possível criar o candidato.';
      },
    });
  }

  private recarregarLista(): void {
    this.carregando = true;
    this.erro = '';
    this.auth.carregarPerfil().subscribe({
      next: (ret) => {
        this.carregando = false;
        this.candidatos = ret.candidatos ?? [];
        if (!this.candidatos.length) {
          this.erro = 'Nenhum candidato vinculado ao seu usuário. Contate o administrador.';
        }
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar os candidatos.';
      },
    });
  }

  escolher(c: CandidatoResumo): void {
    this.erro = '';
    this.selecionandoSlug = c.slug;
    this.auth.selecionarCandidato(c.slug).subscribe({
      next: () => {
        this.selecionandoSlug = null;
        const dash = this.auth.areaLogadaSegmento();
        void this.router.navigateByUrl(`/${c.slug}/${dash}`);
      },
      error: (err) => {
        this.selecionandoSlug = null;
        this.erro = err?.error?.message ?? 'Não foi possível selecionar o candidato.';
      },
    });
  }
}
