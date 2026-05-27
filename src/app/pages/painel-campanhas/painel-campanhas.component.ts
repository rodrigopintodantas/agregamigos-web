import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  CampanhaDivulgacaoService,
  EngajamentoPainel,
  PainelCampanhaPessoaItem,
  PainelCampanhaResumo,
  PainelCampanhasPessoasResponse,
  PainelCampanhasResponse,
  PainelEngajamentoContagem,
} from '../../service/campanha-divulgacao.service';

type FiltroListaAtivo =
  | { tipo: 'todos' }
  | { tipo: 'engajamento'; engajamento: EngajamentoPainel; label: string }
  | { tipo: 'campanha_sem_resposta'; campanhaId: number; campanhaNome: string; label: string }
  | { tipo: 'campanha_enviados'; campanhaId: number; campanhaNome: string; label: string }
  | { tipo: 'campanha_engajamento'; campanhaId: number; campanhaNome: string; engajamento: EngajamentoPainel; label: string };

type ParamsListaPessoas = {
  engajamento?: EngajamentoPainel | null;
  campanha_id?: number | null;
  filtro: 'engajamento' | 'campanha_sem_resposta' | 'campanha_enviados';
};

type RespostasCampanha = PainelCampanhaResumo['respostas'];

@Component({
  selector: 'app-painel-campanhas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './painel-campanhas.component.html',
  styleUrl: './painel-campanhas.component.scss',
})
export class PainelCampanhasComponent implements OnInit {
  private campanhaService = inject(CampanhaDivulgacaoService);
  private cdr = inject(ChangeDetectorRef);

  carregando = true;
  carregandoLista = false;
  erro = '';
  erroLista = '';

  painel: PainelCampanhasResponse | null = null;
  campanhas: PainelCampanhaResumo[] = [];
  engajamento: PainelEngajamentoContagem = {
    sem_resposta: 0,
    positivo: 0,
    negativo: 0,
    neutro: 0,
    total: 0,
  };

  filtroAtivo: FiltroListaAtivo = { tipo: 'todos' };
  paramsListaAtual: ParamsListaPessoas | null = null;
  pessoasLista: PainelCampanhaPessoaItem[] = [];
  listaTitulo = 'Selecione um filtro de engajamento ou uma campanha para ver as pessoas.';
  listaResumo = '';

  paginaLista = 1;
  itensPorPaginaLista = 50;
  totalLista = 0;
  readonly opcoesItensPorPaginaLista = [25, 50, 100];

  readonly cardsEngajamento: { key: EngajamentoPainel; label: string; css: string }[] = [
    { key: 'sem_resposta', label: 'Sem resposta', css: 'card-sem' },
    { key: 'positivo', label: 'Positivo', css: 'card-pos' },
    { key: 'negativo', label: 'Negativo', css: 'card-neg' },
    { key: 'neutro', label: 'Neutro', css: 'card-neu' },
  ];

  readonly opcoesEdicaoEngajamento: { value: EngajamentoPainel; label: string }[] = [
    { value: 'positivo', label: 'Positivo' },
    { value: 'negativo', label: 'Negativo' },
    { value: 'neutro', label: 'Neutro' },
    { value: 'sem_resposta', label: 'Sem resposta' },
  ];

  dialogEngajamentoAberto = false;
  pessoaDialogEngajamento: PainelCampanhaPessoaItem | null = null;
  engajamentoDialogValor: EngajamentoPainel = 'positivo';
  salvandoDialogEngajamento = false;
  erroDialogEngajamento = '';

  ngOnInit(): void {
    this.carregarPainel();
  }

  get exibirPainel(): boolean {
    return !this.carregando && !this.erro;
  }

  get totalPessoasCadastradas(): number {
    return this.painel?.totais?.pessoas_cadastradas ?? this.engajamento.total ?? 0;
  }

  get totalCampanhas(): number {
    return this.painel?.totais?.campanhas ?? this.campanhas.length ?? 0;
  }

  get totalCampanhasRealizadas(): number {
    return this.painel?.totais?.campanhas_realizadas ?? 0;
  }

  carregarPainel(): void {
    this.carregando = true;
    this.erro = '';
    this.campanhaService
      .painel()
      .pipe(finalize(() => {
        this.carregando = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          const normalizado = this.normalizarPainelResumo(data);
          this.painel = normalizado;
          this.engajamento = normalizado.engajamento;
          this.campanhas = normalizado.campanhas;
        },
        error: (err) => {
          const status = err?.status;
          const msgApi = err?.error?.message;
          if (status === 404) {
            this.erro =
              'Rota do painel não encontrada na API. Reinicie o servidor agregamigos-api e tente novamente.';
          } else if (status === 401 || status === 403) {
            this.erro = msgApi ?? 'Sem permissão para acessar o painel (perfil Administrador).';
          } else {
            this.erro = msgApi ?? err?.message ?? 'Não foi possível carregar o painel de campanhas.';
          }
        },
      });
  }

  respostasDaCampanha(c: PainelCampanhaResumo): RespostasCampanha {
    return (
      c.respostas ?? {
        com_resposta: 0,
        sem_resposta: 0,
        positivo: 0,
        negativo: 0,
        neutro: 0,
      }
    );
  }

  quantidadeEngajamento(key: EngajamentoPainel): number {
    return this.engajamento[key] ?? 0;
  }

  percentualEngajamento(key: EngajamentoPainel): number {
    const total = this.engajamento.total || 0;
    if (!total) return 0;
    return Math.round((this.quantidadeEngajamento(key) / total) * 100);
  }

  get totalPaginasLista(): number {
    return Math.max(1, Math.ceil(this.totalLista / this.itensPorPaginaLista));
  }

  get intervaloListaLabel(): string {
    if (!this.totalLista) return 'Nenhum registro';
    const inicio = (this.paginaLista - 1) * this.itensPorPaginaLista + 1;
    const fim = Math.min(this.paginaLista * this.itensPorPaginaLista, this.totalLista);
    return `${inicio}–${fim} de ${this.totalLista}`;
  }

  mostraColunaEnviadoEm(): boolean {
    return (
      this.filtroAtivo.tipo === 'campanha_sem_resposta' || this.filtroAtivo.tipo === 'campanha_enviados'
    );
  }

  mostraColunaMensagem(): boolean {
    if (!this.paramsListaAtual) return false;
    return this.paramsListaAtual.filtro !== 'campanha_sem_resposta';
  }

  rotuloColunaMensagem(): string {
    return 'Resposta recebida';
  }

  mostraColunaEditarEngajamento(): boolean {
    return this.filtroAtivo.tipo === 'campanha_engajamento';
  }

  podeEditarEngajamento(p: PainelCampanhaPessoaItem): boolean {
    return this.mostraColunaEditarEngajamento() && Number(p.destinatario_id) > 0;
  }

  abrirDialogEngajamento(p: PainelCampanhaPessoaItem): void {
    this.pessoaDialogEngajamento = p;
    this.engajamentoDialogValor = this.normalizarEngajamentoKey(p.engajamento_whatsapp);
    this.erroDialogEngajamento = '';
    this.dialogEngajamentoAberto = true;
  }

  fecharDialogEngajamento(): void {
    if (this.salvandoDialogEngajamento) return;
    this.dialogEngajamentoAberto = false;
    this.pessoaDialogEngajamento = null;
    this.erroDialogEngajamento = '';
  }

  confirmarDialogEngajamento(): void {
    const p = this.pessoaDialogEngajamento;
    const destinatarioId = Number(p?.destinatario_id);
    if (!destinatarioId) return;

    this.erroDialogEngajamento = '';
    this.salvandoDialogEngajamento = true;

    this.campanhaService
      .atualizarEngajamentoDestinatarioPainel({
        destinatario_id: destinatarioId,
        engajamento: this.engajamentoDialogValor,
      })
      .pipe(
        finalize(() => {
          this.salvandoDialogEngajamento = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.fecharDialogEngajamento();
          this.carregarPainel();
          this.recarregarListaAtual();
        },
        error: (err) => {
          this.erroDialogEngajamento =
            err?.error?.message ?? 'Não foi possível atualizar o engajamento desta resposta.';
        },
      });
  }

  filtrarPorEngajamento(key: EngajamentoPainel): void {
    const card = this.cardsEngajamento.find((c) => c.key === key);
    this.filtroAtivo = {
      tipo: 'engajamento',
      engajamento: key,
      label: card?.label ?? key,
    };
    this.paginaLista = 1;
    this.buscarPessoas({ engajamento: key, filtro: 'engajamento' });
  }

  verTodasPessoas(): void {
    this.filtroAtivo = { tipo: 'todos' };
    this.paginaLista = 1;
    this.buscarPessoas({ filtro: 'engajamento' });
  }

  filtrarCampanhaEnviados(c: PainelCampanhaResumo): void {
    this.filtroAtivo = {
      tipo: 'campanha_enviados',
      campanhaId: c.id,
      campanhaNome: c.nome,
      label: c.nome,
    };
    this.paginaLista = 1;
    this.buscarPessoas({ campanha_id: c.id, filtro: 'campanha_enviados' });
  }

  filtrarCampanhaSemResposta(c: PainelCampanhaResumo): void {
    this.filtroAtivo = {
      tipo: 'campanha_sem_resposta',
      campanhaId: c.id,
      campanhaNome: c.nome,
      label: c.nome,
    };
    this.paginaLista = 1;
    this.buscarPessoas({ campanha_id: c.id, filtro: 'campanha_sem_resposta' });
  }

  filtrarCampanhaPorEngajamento(c: PainelCampanhaResumo, key: EngajamentoPainel): void {
    const card = this.cardsEngajamento.find((x) => x.key === key);
    this.filtroAtivo = {
      tipo: 'campanha_engajamento',
      campanhaId: c.id,
      campanhaNome: c.nome,
      engajamento: key,
      label: `${c.nome} · ${card?.label ?? key}`,
    };
    this.paginaLista = 1;
    this.buscarPessoas({ campanha_id: c.id, engajamento: key, filtro: 'engajamento' });
  }

  cardEngajamentoAtivo(key: EngajamentoPainel): boolean {
    if (this.filtroAtivo.tipo === 'engajamento') {
      return this.filtroAtivo.engajamento === key;
    }
    if (this.filtroAtivo.tipo === 'campanha_engajamento') {
      return this.filtroAtivo.engajamento === key;
    }
    return false;
  }

  campanhaEnviadosAtiva(c: PainelCampanhaResumo): boolean {
    return this.filtroAtivo.tipo === 'campanha_enviados' && this.filtroAtivo.campanhaId === c.id;
  }

  campanhaSemRespostaAtiva(c: PainelCampanhaResumo): boolean {
    return (
      this.filtroAtivo.tipo === 'campanha_sem_resposta' && this.filtroAtivo.campanhaId === c.id
    );
  }

  campanhaEngajamentoAtiva(c: PainelCampanhaResumo, key: EngajamentoPainel): boolean {
    return (
      this.filtroAtivo.tipo === 'campanha_engajamento' &&
      this.filtroAtivo.campanhaId === c.id &&
      this.filtroAtivo.engajamento === key
    );
  }

  aoAlterarItensPorPaginaLista(): void {
    this.paginaLista = 1;
    this.recarregarListaAtual();
  }

  paginaListaAnterior(): void {
    if (this.paginaLista > 1) {
      this.paginaLista -= 1;
      this.recarregarListaAtual();
    }
  }

  paginaListaProxima(): void {
    if (this.paginaLista < this.totalPaginasLista) {
      this.paginaLista += 1;
      this.recarregarListaAtual();
    }
  }

  private recarregarListaAtual(): void {
    if (!this.paramsListaAtual) return;
    this.buscarPessoas(this.paramsListaAtual);
  }

  private buscarPessoas(params: ParamsListaPessoas): void {
    this.paramsListaAtual = params;
    this.carregandoLista = true;
    this.erroLista = '';
    this.pessoasLista = [];

    this.campanhaService
      .painelPessoas({
        ...params,
        page: this.paginaLista,
        limit: this.itensPorPaginaLista,
      })
      .pipe(
        finalize(() => {
          this.carregandoLista = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (resp) => {
          const normalizado = this.normalizarRespostaPessoas(resp);
          if (!normalizado) {
            this.erroLista =
              'Resposta inválida ao listar pessoas. Confirme se a API foi reiniciada (rota GET /campanhas-divulgacao/painel/pessoas).';
            return;
          }

          this.pessoasLista = normalizado.pessoas;
          this.totalLista = normalizado.total;
          this.paginaLista = normalizado.page ?? this.paginaLista;
          this.atualizarTitulosLista(normalizado, params);
        },
        error: (err) => {
          const status = err?.status;
          if (status === 404) {
            this.erroLista = 'Rota /painel/pessoas não encontrada. Reinicie a API.';
          } else {
            this.erroLista = err?.error?.message ?? 'Não foi possível carregar a lista de pessoas.';
          }
        },
      });
  }

  private normalizarPainelResumo(data: PainelCampanhasResponse | null | undefined): PainelCampanhasResponse {
    const engBase = data?.engajamento ?? this.engajamento;
    const engajamento: PainelEngajamentoContagem = {
      sem_resposta: Number(engBase.sem_resposta) || 0,
      positivo: Number(engBase.positivo) || 0,
      negativo: Number(engBase.negativo) || 0,
      neutro: Number(engBase.neutro) || 0,
      total: Number(engBase.total) || 0,
    };

    const campanhas = (data?.campanhas ?? []).map((c) => {
      const r = c.respostas ?? ({} as RespostasCampanha);
      return {
        ...c,
        respostas: {
          com_resposta: Number(r.com_resposta) || 0,
          sem_resposta: Number(r.sem_resposta) || 0,
          positivo: Number(r.positivo) || 0,
          negativo: Number(r.negativo) || 0,
          neutro: Number(r.neutro) || 0,
        },
      };
    });

    return {
      totais: {
        pessoas_cadastradas: Number(data?.totais?.pessoas_cadastradas) || engajamento.total,
        campanhas: Number(data?.totais?.campanhas) || campanhas.length,
        campanhas_realizadas: Number(data?.totais?.campanhas_realizadas) || 0,
      },
      engajamento,
      campanhas,
    };
  }

  private normalizarRespostaPessoas(body: unknown): PainelCampanhasPessoasResponse | null {
    if (!body || typeof body !== 'object') return null;
    const raw = body as Record<string, unknown>;

    // Corpo do GET /painel (resumo), não da listagem de pessoas
    if ('totais' in raw && !('filtro' in raw)) {
      return null;
    }

    const pessoas = Array.isArray(raw['pessoas'])
      ? (raw['pessoas'] as PainelCampanhaPessoaItem[])
      : [];

    return {
      filtro: (raw['filtro'] as PainelCampanhasPessoasResponse['filtro']) ?? 'engajamento',
      engajamento: (raw['engajamento'] as EngajamentoPainel | null) ?? null,
      campanha_id: raw['campanha_id'] != null ? Number(raw['campanha_id']) : null,
      campanha_nome: raw['campanha_nome'] != null ? String(raw['campanha_nome']) : null,
      total: Number(raw['total']) || 0,
      page: Number(raw['page']) || 1,
      limit: Number(raw['limit']) || this.itensPorPaginaLista,
      pessoas,
    };
  }

  private atualizarTitulosLista(resp: PainelCampanhasPessoasResponse, params: ParamsListaPessoas): void {
    const labelEng =
      resp.engajamento != null
        ? (this.cardsEngajamento.find((x) => x.key === resp.engajamento)?.label ?? resp.engajamento)
        : '';

    if (params.filtro === 'campanha_enviados' && resp.campanha_nome) {
      this.listaTitulo = `Enviados na campanha «${resp.campanha_nome}»`;
    } else if (params.filtro === 'campanha_sem_resposta' && resp.campanha_nome) {
      this.listaTitulo = `Sem resposta na campanha «${resp.campanha_nome}»`;
    } else if (resp.campanha_nome && labelEng) {
      this.listaTitulo = `Campanha «${resp.campanha_nome}» — ${labelEng}`;
    } else if (labelEng) {
      this.listaTitulo = `Engajamento: ${labelEng}`;
    } else if (this.filtroAtivo.tipo === 'todos') {
      this.listaTitulo = 'Todas as pessoas cadastradas';
    } else {
      this.listaTitulo = 'Pessoas filtradas';
    }

    this.listaResumo = this.intervaloListaLabel;
  }

  labelEngajamento(value?: string | null): string {
    const k = String(value ?? 'sem_resposta').toLowerCase();
    const card = this.cardsEngajamento.find((c) => c.key === k);
    return card?.label ?? 'Sem resposta';
  }

  classeEngajamento(value?: string | null): string {
    const k = String(value ?? 'sem_resposta').toLowerCase();
    if (k === 'positivo') return 'tag-eng-pos';
    if (k === 'negativo') return 'tag-eng-neg';
    if (k === 'neutro') return 'tag-eng-neu';
    return 'tag-eng-sem';
  }

  labelStatusCampanha(status: string): string {
    const map: Record<string, string> = {
      rascunho: 'Rascunho',
      montada: 'Montada',
      em_andamento: 'Em andamento',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
    };
    return map[status] ?? status;
  }

  formatarWhatsapp(value?: string | null): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '—';
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  formatarData(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  textoMensagemLista(p: PainelCampanhaPessoaItem): string {
    const t = String(p.mensagem ?? '').trim();
    return t || '—';
  }

  private normalizarEngajamentoKey(value?: string | null): EngajamentoPainel {
    const k = String(value ?? 'sem_resposta').toLowerCase();
    if (k === 'positivo' || k === 'negativo' || k === 'neutro' || k === 'sem_resposta') {
      return k;
    }
    return 'sem_resposta';
  }
}
