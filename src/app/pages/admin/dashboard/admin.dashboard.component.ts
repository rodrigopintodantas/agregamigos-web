import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import QRCode from 'qrcode';
import { BairroQuantidade, PessoaItem, PessoaService } from '../../../service/pessoa.service';
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
  private router = inject(Router);

  totalCadastros = 0;
  topBairros: BairroQuantidade[] = [];
  aniversariantesHoje: { id: number; nome: string; whatsapp: string }[] = [];
  dialogAniversariantesAberto = false;
  carregando = true;
  erro = '';

  /** URL absoluta do link de cadastro com chave opaca estável (`?ChaveAleatoria`); legado `?coordenador=` se a chave não puder ser obtida. */
  linkCadastroDivulgacaoCoordenador = '';

  /** Link público de cadastro do candidato (painel administrador, sem vínculo a coordenador). */
  linkCadastroPainel = '';

  dialogQrcodeLinkAberto = false;
  linkCadastroQrcodeDataUrl = '';
  gerandoQrcodeLink = false;

  ngOnInit(): void {
    this.carregarEstatisticas();
    this.carregarAniversariantesHoje();
    this.carregarLinkCadastroPainel();
  }

  get totalAniversariantesHoje(): number {
    return this.aniversariantesHoje.length;
  }

  private carregarLinkCadastroPainel(): void {
    this.linkCadastroDivulgacaoCoordenador = '';
    this.linkCadastroPainel = '';

    const path = this.auth.rotaComCandidato('link-cadastro');
    if (!path || path === '/selecionar-candidato') {
      return;
    }

    const origin =
      typeof globalThis !== 'undefined' && 'location' in globalThis
        ? (globalThis as unknown as { location: { origin: string } }).location.origin
        : '';

    if (this.auth.isAdmin()) {
      this.linkCadastroPainel = `${origin}${path}`;
      return;
    }

    if (!this.auth.isCoordenador()) {
      return;
    }

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

  abrirDialogAniversariantes(): void {
    if (!this.totalAniversariantesHoje) return;
    this.dialogAniversariantesAberto = true;
  }

  fecharDialogAniversariantes(): void {
    this.dialogAniversariantesAberto = false;
  }

  parabenizarAniversariantes(): void {
    if (!this.aniversariantesHoje.length) return;
    const ids = this.aniversariantesHoje.map((p) => p.id).join(',');
    const hoje = new Date();
    const data = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    void this.router.navigate(this.auth.routerSegments('admin', 'divulgacao'), {
      queryParams: {
        aniversariantes: '1',
        aniversariante_ids: ids,
        data,
      },
    });
    this.fecharDialogAniversariantes();
  }

  copiarLinkCadastroPainel(): void {
    const t = this.auth.isCoordenador()
      ? this.linkCadastroDivulgacaoCoordenador
      : this.linkCadastroPainel;
    if (!t) return;
    void navigator.clipboard?.writeText(t).catch(() => {
      /* ignore */
    });
  }

  abrirDialogQrcodeLinkCadastro(): void {
    if (!this.linkCadastroPainel || this.gerandoQrcodeLink) return;

    this.gerandoQrcodeLink = true;
    void QRCode.toDataURL(this.linkCadastroPainel, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        this.linkCadastroQrcodeDataUrl = dataUrl;
        this.dialogQrcodeLinkAberto = true;
      })
      .catch(() => {
        this.linkCadastroQrcodeDataUrl = '';
      })
      .finally(() => {
        this.gerandoQrcodeLink = false;
      });
  }

  fecharDialogQrcodeLinkCadastro(): void {
    this.dialogQrcodeLinkAberto = false;
  }

  private carregarAniversariantesHoje(): void {
    this.pessoaService.listar().subscribe({
      next: (lista) => {
        const hoje = new Date();
        this.aniversariantesHoje = lista
          .filter((p) => this.ehAniversarianteHoje(p, hoje))
          .map((p) => ({
            id: Number(p.id),
            nome: String(p.nome ?? 'Sem nome'),
            whatsapp: this.formatarWhatsapp(p.whatsapp),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      },
      error: () => {
        this.aniversariantesHoje = [];
      },
    });
  }

  private ehAniversarianteHoje(pessoa: PessoaItem, hoje: Date): boolean {
    const raw = String(pessoa.data_nascimento ?? '').trim();
    if (!raw) return false;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;
    const mes = Number(match[2]);
    const dia = Number(match[3]);
    return mes === hoje.getMonth() + 1 && dia === hoje.getDate();
  }

  private formatarWhatsapp(value?: string | null): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '—';
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  }
}
