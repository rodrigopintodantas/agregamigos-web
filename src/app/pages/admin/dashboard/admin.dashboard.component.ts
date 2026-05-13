import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { BairroQuantidade, PessoaService } from '../../../service/pessoa.service';
import { AutenticacaoService } from '../../../service/autenticacao.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.dashboard.component.html',
  styleUrl: './admin.dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  auth = inject(AutenticacaoService);
  private pessoaService = inject(PessoaService);

  totalCadastros = 0;
  topBairros: BairroQuantidade[] = [];
  carregando = true;
  erro = '';

  /** URL absoluta do link de cadastro com chave opaca estável (`?ChaveAleatoria`); legado `?coordenador=` se a chave não puder ser obtida. */
  linkCadastroDivulgacaoCoordenador = '';

  ngOnInit(): void {
    this.carregarEstatisticas();
    this.carregarLinkDivulgacaoCoordenador();
  }

  private carregarLinkDivulgacaoCoordenador(): void {
    if (!this.auth.isCoordenador()) {
      this.linkCadastroDivulgacaoCoordenador = '';
      return;
    }
    const path = this.auth.rotaComCandidato('link-cadastro');
    if (!path || path === '/selecionar-candidato') {
      this.linkCadastroDivulgacaoCoordenador = '';
      return;
    }
    const origin =
      typeof globalThis !== 'undefined' && 'location' in globalThis
        ? (globalThis as unknown as { location: { origin: string } }).location.origin
        : '';
    const id = this.auth.getUsuario()?.id;
    const legado =
      id != null ? `${origin}${path}?coordenador=${encodeURIComponent(String(id))}` : '';

    this.auth.obterChaveDivulgacaoLinkCadastro().subscribe({
      next: ({ chave_publica }) => {
        this.linkCadastroDivulgacaoCoordenador = `${origin}${path}?${chave_publica}`;
      },
      error: () => {
        this.linkCadastroDivulgacaoCoordenador = legado;
      },
    });
  }

  carregarEstatisticas(): void {
    this.carregando = true;
    this.erro = '';
    this.pessoaService.estatisticas().subscribe({
      next: (data) => {
        this.totalCadastros = data.total_cadastros;
        this.topBairros = data.bairros ?? [];
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os dados do painel.';
        this.carregando = false;
      },
    });
  }

  copiarLinkDivulgacao(): void {
    const t = this.linkCadastroDivulgacaoCoordenador;
    if (!t) return;
    void navigator.clipboard?.writeText(t).catch(() => {
      /* ignore */
    });
  }
}
