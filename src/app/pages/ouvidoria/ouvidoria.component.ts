import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OuvidoriaItem, OuvidoriaService } from '../../service/ouvidoria.service';

/** Nomes das colunas (iguais à tabela `ouvidoria`, exceto id e timestamps). Ordem = arquivo oficial pipe-delimitado. */
export const CAMPOS_OUVIDORIA_CSV = [
  'dt_manifestacao',
  'fl_indicador',
  'ds_situacao',
  'ds_tipo',
  'ds_assunto',
  'ds_ra',
  'nm_setor',
  'nm_orgao',
  'ds_canal',
] as const;

/** Cabeçalho de arquivos exportados antes da renomeação das colunas (mesma ordem de campos). */
export const CAMPOS_OUVIDORIA_CSV_LEGADO = [
  'dt_manifestacao',
  'fl_indicador',
  'ds_situacao',
  'ds_tipo',
  'ds_assunto',
  'ds_ra',
  'nm_orgao',
  'nm_secretaria',
  'ds_canal',
] as const;

const COLUNAS_OCULTAS_NA_TABELA = new Set<string>([]);

const COLUNAS_ORDENACAO_BOOLEANA = new Set(['fl_indicador']);

const COLUNAS_ORDENACAO_DATA = new Set(['dt_manifestacao']);

const ORDENACAO_PADRAO = { col: 'dt_manifestacao', dir: 'desc' as const };

const CHAVE_VAZIO = '__vazio__';

const NOMES_MES_BARRAS_POR_ZONA = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** Série no gráfico de evolução (aba Por Zona). */
export interface SerieEvolucaoAssuntoOuvidoria {
  chave: string;
  rotulo: string;
  totaisPorAno: number[];
}

export interface EvolucaoAssuntosPorZona {
  /** Maior ano com manifestação neste ds_ra (base para o top 10 de assuntos). */
  anoReferencia: number;
  anos: number[];
  series: SerieEvolucaoAssuntoOuvidoria[];
  maxY: number;
}

/** Uma linha do gráfico de barras por assunto (aba Por Zona). */
export interface AssuntoBarraLinha {
  chave: string;
  rotulo: string;
  total: number;
}

/** Linha de comparação de períodos por assunto (aba Progresso). */
export interface ProgressoAssuntoNegativoLinha {
  chave: string;
  rotulo: string;
  totalAnterior: number;
  totalAtual: number;
  delta: number;
}

/** Comparação jan.–mês da data mais recente vs mesmo intervalo do ano anterior. */
export interface ProgressoAssuntoNegativoDados {
  dataReferenciaLabel: string;
  anoAtual: number;
  anoAnterior: number;
  mesAte: number;
  nomeMesAte: string;
  /** Se true, colunas são anos civis completos (jan.–dez.). */
  comparacaoAnosCivisCompletos: boolean;
  linhas: ProgressoAssuntoNegativoLinha[];
}

/** Filtro de período da aba Progresso. */
export type PeriodoProgressoOuvidoria = 'atual' | '2024-2025' | '2023-2024';

@Component({
  selector: 'app-ouvidoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ouvidoria.component.html',
  styleUrl: './ouvidoria.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OuvidoriaComponent implements OnInit, OnDestroy {
  private ouvidoriaService = inject(OuvidoriaService);
  private cdr = inject(ChangeDetectorRef);

  painelFiltroEstilo: Record<string, string> | null = null;
  private filtroTriggerEl: HTMLElement | null = null;
  private readonly reposicionarPainel = (): void => {
    if (this.colunaFiltroAberta && this.filtroTriggerEl) {
      this.posicionarPainelFiltro();
    }
  };

  readonly colunasExibicao = (CAMPOS_OUVIDORIA_CSV as readonly string[]).filter(
    (c) => !COLUNAS_OCULTAS_NA_TABELA.has(c),
  );

  itens: OuvidoriaItem[] = [];
  /** Texto para busca por registro (pré-calculado ao carregar `itens`). */
  private textoBuscaPorId = new Map<number, string>();
  /** Termo aplicado na filtragem (debounced em relação ao campo de busca). */
  private termoBuscaAplicado = '';
  private pesquisaDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  itensFiltrados: OuvidoriaItem[] = [];
  itensFiltradosOrdenados: OuvidoriaItem[] = [];
  itensPaginados: OuvidoriaItem[] = [];
  totalPaginas = 1;
  paginasVisiveisLista: number[] = [1];

  opcoesDistintasPorColuna: Record<string, string[]> = {};
  filtrosColuna: Record<string, string[]> = {};
  colunaFiltroAberta: string | null = null;
  /** Texto da busca dentro do painel de filtro (refina a lista de checkboxes). */
  termoBuscaFiltro = '';

  ordenacao: { col: string; dir: 'asc' | 'desc' } | null = {
    col: ORDENACAO_PADRAO.col,
    dir: ORDENACAO_PADRAO.dir,
  };

  termoPesquisa = '';
  carregando = true;
  erro = '';
  importandoCsv = false;
  mensagemImportacao = '';
  menuExportarAberto = false;

  /** Aba: visão completa, por zona ou progresso. */
  abaOuvidoria: 'completa' | 'por-zona' | 'progresso' = 'completa';

  /** Valores distintos de `ds_ra` nos dados carregados (texto exatamente como na coluna). */
  dsRaOpcoesPorZona: string[] = [];
  dsRaSelecionadaPorZona: string | null = null;
  /** RA escolhida na aba Progresso (mesmas opções que `dsRaOpcoesPorZona`). */
  dsRaSelecionadaProgressoAtual: string | null = null;

  readonly opcoesPeriodoProgresso: { valor: PeriodoProgressoOuvidoria; rotulo: string }[] = [
    { valor: 'atual', rotulo: 'Atual' },
    { valor: '2024-2025', rotulo: '2024–2025' },
    { valor: '2023-2024', rotulo: '2023–2024' },
  ];
  periodoProgressoSelecionado: PeriodoProgressoOuvidoria = 'atual';

  /** Gráfico: top 10 assuntos do último ano (por ds_ra) × evolução por ano. */
  evolucaoAssuntosPorZona: EvolucaoAssuntosPorZona | null = null;

  /** Barras horizontais: quantidade por assunto no ano filtrado (por ds_ra). */
  anosDisponiveisBarrasPorZona: number[] = [];
  anoSelecionadoBarrasPorZona: number | null = null;
  /** Meses (1–12) com manifestação no `anoSelecionadoBarrasPorZona` neste ds_ra. */
  mesesDisponiveisBarrasPorZona: number[] = [];
  /** `null` = todos os meses do ano. */
  mesSelecionadoBarrasPorZona: number | null = null;
  assuntosBarrasPorZona: AssuntoBarraLinha[] = [];
  maxTotalBarrasAssuntos = 1;
  orgaosBarrasPorZona: AssuntoBarraLinha[] = [];
  maxTotalBarrasOrgaos = 1;

  /** Aba Progresso: top 5 assuntos com maior aumento no período (vs ano anterior). */
  progressoAssuntoNegativo: ProgressoAssuntoNegativoDados | null = null;
  /** Aba Progresso: top 5 assuntos com maior redução no período (vs ano anterior). */
  progressoAssuntoPositivo: ProgressoAssuntoNegativoDados | null = null;

  readonly evolucaoSvgW = 840;
  readonly evolucaoSvgH = 400;
  readonly evolucaoPad = { l: 52, r: 28, t: 24, b: 88 };

  paginaAtual = 1;
  itensPorPagina = 10;
  readonly opcoesItensPorPagina = [10, 20, 50, 100];

  ngOnInit(): void {
    this.carregar();
    window.addEventListener('scroll', this.reposicionarPainel, true);
    window.addEventListener('resize', this.reposicionarPainel);
  }

  ngOnDestroy(): void {
    if (this.pesquisaDebounceHandle != null) {
      clearTimeout(this.pesquisaDebounceHandle);
      this.pesquisaDebounceHandle = null;
    }
    this.fecharPainelFiltro();
    this.menuExportarAberto = false;
    window.removeEventListener('scroll', this.reposicionarPainel, true);
    window.removeEventListener('resize', this.reposicionarPainel);
  }

  /** Evita reavaliação da lista a cada ciclo de change detection (crítico com ~100k+ linhas). */
  trackByLinhaId = (_: number, v: OuvidoriaItem): number => v.id;

  private reindexarTextoBusca(): void {
    this.textoBuscaPorId.clear();
    for (const v of this.itens) {
      this.textoBuscaPorId.set(v.id, this.textoLinha(v));
    }
  }

  /** Filtra + ordena; custo O(n) ou O(n log n) — chamar só quando dados, filtros, busca ou ordenação mudam. */
  private recomputarFiltradoEOrdenado(): void {
    let lista = this.itens.filter((v) => this.passouFiltrosColuna(v));
    const termo = this.termoBuscaAplicado;
    if (termo) {
      lista = lista.filter((item) => (this.textoBuscaPorId.get(item.id) ?? '').includes(termo));
    }
    this.itensFiltrados = lista;
    if (!this.ordenacao) {
      this.itensFiltradosOrdenados = lista;
    } else {
      this.itensFiltradosOrdenados = [...lista].sort((a, b) => this.compararOrdenacao(a, b));
    }
    this.atualizarPaginaSlice();
  }

  private atualizarPaginaSlice(): void {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    this.itensPaginados = this.itensFiltradosOrdenados.slice(inicio, inicio + this.itensPorPagina);
    this.totalPaginas = Math.max(1, Math.ceil(this.itensFiltrados.length / this.itensPorPagina));
    if (this.paginaAtual > this.totalPaginas) {
      this.paginaAtual = this.totalPaginas;
      const i2 = (this.paginaAtual - 1) * this.itensPorPagina;
      this.itensPaginados = this.itensFiltradosOrdenados.slice(i2, i2 + this.itensPorPagina);
    }
    this.paginasVisiveisLista = this.calcPaginasVisiveis();
    this.cdr.markForCheck();
  }

  private calcPaginasVisiveis(): number[] {
    return this.calcPaginasVisiveisPara(this.paginaAtual, this.totalPaginas);
  }

  private calcPaginasVisiveisPara(paginaAtual: number, totalPaginas: number): number[] {
    const maxBotoes = 5;
    const total = totalPaginas;
    if (total <= maxBotoes) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }
    const metade = Math.floor(maxBotoes / 2);
    let inicio = paginaAtual - metade;
    let fim = paginaAtual + metade;
    if (inicio < 1) {
      inicio = 1;
      fim = maxBotoes;
    } else if (fim > total) {
      fim = total;
      inicio = total - maxBotoes + 1;
    }
    return Array.from({ length: fim - inicio + 1 }, (_, index) => inicio + index);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.cdr.markForCheck();
    this.ouvidoriaService.listar().subscribe({
      next: (rows) => {
        this.itens = rows;
        this.filtrosColuna = {};
        this.ordenacao = { col: ORDENACAO_PADRAO.col, dir: ORDENACAO_PADRAO.dir };
        this.fecharPainelFiltro();
        this.opcoesDistintasPorColuna = {};
        this.termoBuscaAplicado = this.termoPesquisa.trim().toLowerCase();
        this.paginaAtual = 1;
        this.reindexarTextoBusca();
        this.recomputarFiltradoEOrdenado();
        this.reconstruirOpcoesDsRaPorZona();
        this.sincronizarSelecaoDsRaPorZona();
        this.sincronizarSelecaoDsRaProgressoAtual();
        this.recomputarBarrasAssuntosPorZona();
        this.recomputarEvolucaoAssuntosPorZona();
        this.recomputarProgressoAssuntoNegativo();
        this.carregando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os dados de ouvidoria.';
        this.carregando = false;
        this.cdr.markForCheck();
      },
    });
  }

  definirAba(aba: 'completa' | 'por-zona' | 'progresso'): void {
    if (this.abaOuvidoria === aba) return;
    this.abaOuvidoria = aba;
    if (aba !== 'completa') {
      this.fecharPainelFiltro();
      this.fecharMenuExportar();
    }
    this.cdr.markForCheck();
  }

  definirDsRaPorZona(dsRa: string): void {
    this.dsRaSelecionadaPorZona = dsRa;
    this.recomputarBarrasAssuntosPorZona();
    this.recomputarEvolucaoAssuntosPorZona();
  }

  definirDsRaProgressoAtual(dsRa: string): void {
    this.dsRaSelecionadaProgressoAtual = dsRa;
    this.recomputarProgressoAssuntoNegativo();
  }

  definirPeriodoProgresso(periodo: PeriodoProgressoOuvidoria): void {
    this.periodoProgressoSelecionado = periodo;
    this.recomputarProgressoAssuntoNegativo();
  }

  rotuloPeriodoProgressoSelecionado(): string {
    return (
      this.opcoesPeriodoProgresso.find((o) => o.valor === this.periodoProgressoSelecionado)?.rotulo ??
      this.periodoProgressoSelecionado
    );
  }

  /** Cabeçalho de coluna: ano civil ou jan.–mês. */
  labelCabecalhoColunaProgresso(ano: number, prog: ProgressoAssuntoNegativoDados): string {
    if (prog.comparacaoAnosCivisCompletos) {
      return String(ano);
    }
    return this.labelPeriodoProgresso(ano, prog.nomeMesAte);
  }

  definirAnoBarrasPorZona(ano: number): void {
    this.anoSelecionadoBarrasPorZona = ano;
    this.mesSelecionadoBarrasPorZona = null;
    this.recomputarBarrasAssuntosPorZona({ preservarAnoSeValido: true });
  }

  definirMesBarrasPorZona(mes: number | null | undefined): void {
    this.mesSelecionadoBarrasPorZona = mes ?? null;
    this.recomputarBarrasAssuntosPorZona({
      preservarAnoSeValido: true,
      preservarMesSeValido: true,
    });
  }

  nomeMesBarrasPorZona(mes: number): string {
    return NOMES_MES_BARRAS_POR_ZONA[mes - 1] ?? String(mes);
  }

  mensagemVaziaBarrasPorZona(): string {
    return this.mesSelecionadoBarrasPorZona != null
      ? 'Nenhuma manifestação neste mês.'
      : 'Nenhuma manifestação neste ano.';
  }

  trackByMesBarrasPorZona = (_: number, mes: number): string => String(mes);

  /** Valores distintos não vazios de `ds_ra`, como string (igual ao armazenado no item). */
  private reconstruirOpcoesDsRaPorZona(): void {
    const unicos = new Set<string>();
    for (const v of this.itens) {
      const ra = v.ds_ra;
      if (ra === undefined || ra === null) continue;
      const s = typeof ra === 'string' ? ra : String(ra);
      if (!s) continue;
      unicos.add(s);
    }
    this.dsRaOpcoesPorZona = Array.from(unicos).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }),
    );
  }

  private sincronizarSelecaoDsRaPorZona(): void {
    const opcoes = this.dsRaOpcoesPorZona;
    if (!opcoes.length) {
      this.dsRaSelecionadaPorZona = null;
      return;
    }
    if (this.dsRaSelecionadaPorZona != null && opcoes.includes(this.dsRaSelecionadaPorZona)) {
      return;
    }
    this.dsRaSelecionadaPorZona = opcoes[0];
  }

  private sincronizarSelecaoDsRaProgressoAtual(): void {
    const opcoes = this.dsRaOpcoesPorZona;
    if (!opcoes.length) {
      this.dsRaSelecionadaProgressoAtual = null;
      return;
    }
    if (this.dsRaSelecionadaProgressoAtual != null && opcoes.includes(this.dsRaSelecionadaProgressoAtual)) {
      return;
    }
    this.dsRaSelecionadaProgressoAtual = opcoes[0];
  }

  private chaveAssuntoFiltro(v: OuvidoriaItem): string {
    const raw = v.ds_assunto;
    if (raw === undefined || raw === null) return CHAVE_VAZIO;
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    return s.length ? s : CHAVE_VAZIO;
  }

  private rotuloAssuntoEvolucao(chave: string): string {
    return chave === CHAVE_VAZIO ? '(sem assunto)' : chave;
  }

  private chaveOrgaoFiltro(v: OuvidoriaItem): string {
    const raw = v.nm_orgao;
    if (raw === undefined || raw === null) return CHAVE_VAZIO;
    const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    return s.length ? s : CHAVE_VAZIO;
  }

  private rotuloOrgaoBarras(chave: string): string {
    return chave === CHAVE_VAZIO ? '(sem órgão)' : chave;
  }

  /** Contagem por assunto e por órgão (`nm_orgao`) no ds_ra + ano (ordenado decrescente). */
  private recomputarBarrasAssuntosPorZona(options?: {
    preservarAnoSeValido?: boolean;
    preservarMesSeValido?: boolean;
  }): void {
    const preservarAno = options?.preservarAnoSeValido ?? false;
    const preservarMes = options?.preservarMesSeValido ?? false;
    const dsRa = this.dsRaSelecionadaPorZona;
    if (dsRa == null) {
      this.anosDisponiveisBarrasPorZona = [];
      this.anoSelecionadoBarrasPorZona = null;
      this.mesesDisponiveisBarrasPorZona = [];
      this.mesSelecionadoBarrasPorZona = null;
      this.assuntosBarrasPorZona = [];
      this.maxTotalBarrasAssuntos = 1;
      this.orgaosBarrasPorZona = [];
      this.maxTotalBarrasOrgaos = 1;
      this.cdr.markForCheck();
      return;
    }
    const porZona = this.itens.filter((v) => v.ds_ra === dsRa);
    const anosSet = new Set<number>();
    for (const v of porZona) {
      const d = this.parseDataOrdenacao(v);
      if (d) anosSet.add(d.getFullYear());
    }
    const anos = [...anosSet].sort((a, b) => a - b);
    this.anosDisponiveisBarrasPorZona = anos;
    if (!anos.length) {
      this.anoSelecionadoBarrasPorZona = null;
      this.mesesDisponiveisBarrasPorZona = [];
      this.mesSelecionadoBarrasPorZona = null;
      this.assuntosBarrasPorZona = [];
      this.maxTotalBarrasAssuntos = 1;
      this.orgaosBarrasPorZona = [];
      this.maxTotalBarrasOrgaos = 1;
      this.cdr.markForCheck();
      return;
    }
    if (
      !preservarAno ||
      this.anoSelecionadoBarrasPorZona == null ||
      !anos.includes(this.anoSelecionadoBarrasPorZona)
    ) {
      this.anoSelecionadoBarrasPorZona = anos[anos.length - 1];
    }
    const ano = this.anoSelecionadoBarrasPorZona!;
    const mesesSet = new Set<number>();
    for (const v of porZona) {
      const d = this.parseDataOrdenacao(v);
      if (!d || d.getFullYear() !== ano) continue;
      mesesSet.add(d.getMonth() + 1);
    }
    const meses = [...mesesSet].sort((a, b) => a - b);
    this.mesesDisponiveisBarrasPorZona = meses;
    if (
      !preservarMes ||
      this.mesSelecionadoBarrasPorZona == null ||
      !meses.includes(this.mesSelecionadoBarrasPorZona)
    ) {
      this.mesSelecionadoBarrasPorZona = null;
    }
    const mesFiltro = this.mesSelecionadoBarrasPorZona;
    const contagemAssunto = new Map<string, number>();
    const contagemOrgao = new Map<string, number>();
    for (const v of porZona) {
      const d = this.parseDataOrdenacao(v);
      if (!d || d.getFullYear() !== ano) continue;
      if (mesFiltro != null && d.getMonth() + 1 !== mesFiltro) continue;
      const ka = this.chaveAssuntoFiltro(v);
      contagemAssunto.set(ka, (contagemAssunto.get(ka) ?? 0) + 1);
      const ko = this.chaveOrgaoFiltro(v);
      contagemOrgao.set(ko, (contagemOrgao.get(ko) ?? 0) + 1);
    }
    const lista: AssuntoBarraLinha[] = [...contagemAssunto.entries()]
      .map(([chave, total]) => ({
        chave,
        rotulo: this.rotuloAssuntoEvolucao(chave),
        total,
      }))
      .sort((a, b) => b.total - a.total);
    this.assuntosBarrasPorZona = lista;
    this.maxTotalBarrasAssuntos = Math.max(1, lista[0]?.total ?? 1);
    const listaOrgao: AssuntoBarraLinha[] = [...contagemOrgao.entries()]
      .map(([chave, total]) => ({
        chave,
        rotulo: this.rotuloOrgaoBarras(chave),
        total,
      }))
      .sort((a, b) => b.total - a.total);
    this.orgaosBarrasPorZona = listaOrgao;
    this.maxTotalBarrasOrgaos = Math.max(1, listaOrgao[0]?.total ?? 1);
    this.cdr.markForCheck();
  }

  percLarguraBarra(total: number, maxTotal: number): number {
    const m = Math.max(1, maxTotal);
    return Math.round((10000 * total) / m) / 100;
  }

  trackByAssuntoBarra = (_: number, row: AssuntoBarraLinha): string => row.chave;

  trackByOrgaoBarra = (_: number, row: AssuntoBarraLinha): string => row.chave;

  trackByProgressoAssuntoNegativo = (_: number, row: ProgressoAssuntoNegativoLinha): string =>
    row.chave;

  /** Rótulo curto do intervalo (jan.–mês) para cabeçalhos de tabela. */
  labelPeriodoProgresso(ano: number, nomeMesAte: string): string {
    return `jan.–${nomeMesAte} ${ano}`;
  }

  /** Compara períodos (Atual: até data máx.; ou anos civis fechados); top 5 aumentos e top 5 reduções. */
  private recomputarProgressoAssuntoNegativo(): void {
    const dsRa = this.dsRaSelecionadaProgressoAtual;
    if (dsRa == null) {
      this.progressoAssuntoNegativo = null;
      this.progressoAssuntoPositivo = null;
      this.cdr.markForCheck();
      return;
    }
    const porRa = this.itens.filter((v) => v.ds_ra === dsRa);
    const periodo = this.periodoProgressoSelecionado;

    let mapAtual: Map<string, number>;
    let mapAnt: Map<string, number>;
    let baseMeta: Omit<ProgressoAssuntoNegativoDados, 'linhas'>;

    if (periodo === 'atual') {
      let maxD: Date | null = null;
      for (const v of porRa) {
        const d = this.parseDataOrdenacao(v);
        if (!d) continue;
        if (!maxD || d.getTime() > maxD.getTime()) maxD = d;
      }
      if (!maxD) {
        this.progressoAssuntoNegativo = null;
        this.progressoAssuntoPositivo = null;
        this.cdr.markForCheck();
        return;
      }
      const anoAtual = maxD.getFullYear();
      const mesAte = maxD.getMonth() + 1;
      const anoAnterior = anoAtual - 1;
      mapAtual = this.contarAssuntosJanAteMes(anoAtual, mesAte, porRa);
      mapAnt = this.contarAssuntosJanAteMes(anoAnterior, mesAte, porRa);
      baseMeta = {
        dataReferenciaLabel: this.formatarDataPtBr(maxD),
        anoAtual,
        anoAnterior,
        mesAte,
        nomeMesAte: this.nomeMesBarrasPorZona(mesAte),
        comparacaoAnosCivisCompletos: false,
      };
    } else {
      const anoAnterior = periodo === '2024-2025' ? 2024 : 2023;
      const anoAtual = periodo === '2024-2025' ? 2025 : 2024;
      mapAtual = this.contarAssuntosJanAteMes(anoAtual, 12, porRa);
      mapAnt = this.contarAssuntosJanAteMes(anoAnterior, 12, porRa);
      baseMeta = {
        dataReferenciaLabel: `Anos civis fechados ${anoAnterior} e ${anoAtual} (jan.–dez.)`,
        anoAtual,
        anoAnterior,
        mesAte: 12,
        nomeMesAte: this.nomeMesBarrasPorZona(12),
        comparacaoAnosCivisCompletos: true,
      };
    }

    const chaves = new Set<string>([...mapAtual.keys(), ...mapAnt.keys()]);
    const linhas: ProgressoAssuntoNegativoLinha[] = [];
    for (const chave of chaves) {
      const totalAtual = mapAtual.get(chave) ?? 0;
      const totalAnterior = mapAnt.get(chave) ?? 0;
      linhas.push({
        chave,
        rotulo: this.rotuloAssuntoEvolucao(chave),
        totalAnterior,
        totalAtual,
        delta: totalAtual - totalAnterior,
      });
    }
    const topAumentos = linhas
      .filter((l) => l.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);
    const topDiminuicoes = linhas
      .filter((l) => l.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);
    this.progressoAssuntoNegativo = { ...baseMeta, linhas: topAumentos };
    this.progressoAssuntoPositivo = { ...baseMeta, linhas: topDiminuicoes };
    this.cdr.markForCheck();
  }

  private contarAssuntosJanAteMes(
    ano: number,
    mesMaxInclusive: number,
    fonte: readonly OuvidoriaItem[],
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const v of fonte) {
      const d = this.parseDataOrdenacao(v);
      if (!d || d.getFullYear() !== ano) continue;
      const mes = d.getMonth() + 1;
      if (mes < 1 || mes > mesMaxInclusive) continue;
      const k = this.chaveAssuntoFiltro(v);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }

  private formatarDataPtBr(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  /**
   * Top 10 `ds_assunto` no último ano com manifestações neste ds_ra;
   * contagens por ano em todos os anos com data válida na mesma RA.
   */
  private recomputarEvolucaoAssuntosPorZona(): void {
    const dsRa = this.dsRaSelecionadaPorZona;
    if (dsRa == null) {
      this.evolucaoAssuntosPorZona = null;
      this.cdr.markForCheck();
      return;
    }
    const porZona = this.itens.filter((v) => v.ds_ra === dsRa);
    const comAno: { ano: number; chave: string }[] = [];
    for (const v of porZona) {
      const d = this.parseDataOrdenacao(v);
      if (!d) continue;
      const ano = d.getFullYear();
      comAno.push({ ano, chave: this.chaveAssuntoFiltro(v) });
    }
    if (!comAno.length) {
      this.evolucaoAssuntosPorZona = null;
      this.cdr.markForCheck();
      return;
    }
    const anos = [...new Set(comAno.map((x) => x.ano))].sort((a, b) => a - b);
    const anoReferencia = anos[anos.length - 1];
    const contagemUltimoAno = new Map<string, number>();
    for (const x of comAno) {
      if (x.ano !== anoReferencia) continue;
      contagemUltimoAno.set(x.chave, (contagemUltimoAno.get(x.chave) ?? 0) + 1);
    }
    const top10 = [...contagemUltimoAno.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([chave]) => chave);
    if (!top10.length) {
      this.evolucaoAssuntosPorZona = null;
      this.cdr.markForCheck();
      return;
    }
    const contagem = new Map<string, number>();
    for (const x of comAno) {
      if (!top10.includes(x.chave)) continue;
      const k = `${x.ano}\t${x.chave}`;
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    const series: SerieEvolucaoAssuntoOuvidoria[] = top10.map((chave) => ({
      chave,
      rotulo: this.rotuloAssuntoEvolucao(chave),
      totaisPorAno: anos.map((ano) => contagem.get(`${ano}\t${chave}`) ?? 0),
    }));
    let maxY = 0;
    for (const s of series) {
      for (const t of s.totaisPorAno) {
        maxY = Math.max(maxY, t);
      }
    }
    maxY = Math.max(maxY, 1);
    this.evolucaoAssuntosPorZona = { anoReferencia, anos, series, maxY };
    this.cdr.markForCheck();
  }

  evolucaoPlotX(anoIndex: number, totalAnos: number): number {
    const innerW = this.evolucaoSvgW - this.evolucaoPad.l - this.evolucaoPad.r;
    if (totalAnos <= 1) {
      return this.evolucaoPad.l + innerW / 2;
    }
    return this.evolucaoPad.l + (innerW * anoIndex) / (totalAnos - 1);
  }

  evolucaoPlotY(val: number, maxY: number): number {
    const innerH = this.evolucaoSvgH - this.evolucaoPad.t - this.evolucaoPad.b;
    return this.evolucaoPad.t + innerH * (1 - val / maxY);
  }

  evolucaoPolylinePoints(serie: SerieEvolucaoAssuntoOuvidoria): string {
    const ch = this.evolucaoAssuntosPorZona;
    if (!ch) return '';
    const n = ch.anos.length;
    return ch.anos
      .map((_, j) => {
        const x = this.evolucaoPlotX(j, n);
        const y = this.evolucaoPlotY(serie.totaisPorAno[j] ?? 0, ch.maxY);
        return `${this.arredondarSvg(x)},${this.arredondarSvg(y)}`;
      })
      .join(' ');
  }

  evolucaoCorSerie(index: number): string {
    const hues = [262, 200, 25, 340, 145, 15, 310, 175, 220, 55];
    return `hsl(${hues[index % hues.length]} 58% 40%)`;
  }

  evolucaoLegendaCurta(rotulo: string, max = 52): string {
    if (rotulo.length <= max) return rotulo;
    return `${rotulo.slice(0, max - 1)}…`;
  }

  private arredondarSvg(n: number): number {
    return Math.round(n * 100) / 100;
  }

  evolucaoTicksY(maxY: number): number[] {
    const n = 4;
    const raw = Array.from({ length: n + 1 }, (_, i) => Math.round((maxY * i) / n));
    return [...new Set(raw)].sort((a, b) => a - b);
  }

  evolucaoAriaLabel(ev: EvolucaoAssuntosPorZona): string {
    const anosTxt = ev.anos.length ? `${ev.anos[0]} a ${ev.anos[ev.anos.length - 1]}` : '';
    return `Evolução das manifestações: ${ev.series.length} assuntos do ano ${ev.anoReferencia}, eixo horizontal anos ${anosTxt}.`;
  }

  tituloColuna(col: string): string {
    return col;
  }

  abrirSeletorCsv(input: HTMLInputElement): void {
    this.mensagemImportacao = '';
    input.click();
  }

  alternarMenuExportar(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuExportarAberto = !this.menuExportarAberto;
    this.cdr.markForCheck();
  }

  fecharMenuExportar(): void {
    this.menuExportarAberto = false;
    this.cdr.markForCheck();
  }

  exportarPara(formato: 'csv' | 'xls'): void {
    if (formato === 'csv') {
      this.exportarCsvArquivo();
    } else {
      this.exportarXlsArquivo();
    }
    this.fecharMenuExportar();
  }

  private exportarCsvArquivo(): void {
    const dados = this.itensFiltradosOrdenados;
    if (!dados.length) return;

    const headers = [...CAMPOS_OUVIDORIA_CSV];
    const linhas: string[] = [];
    linhas.push(headers.map((h) => this.escaparCelulaPipe(h)).join('|'));
    for (const v of dados) {
      const cells = headers.map((col) => this.escaparCelulaPipe(this.valorParaPipeExport(v, col)));
      linhas.push(cells.join('|'));
    }

    const bom = '\uFEFF';
    const blob = new Blob([bom + linhas.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    this.dispararDownload(blob, `ouvidoria-${this.dataArquivoExport()}.csv`);
  }

  private exportarXlsArquivo(): void {
    const dados = this.itensFiltradosOrdenados;
    if (!dados.length) return;

    const headers = [...CAMPOS_OUVIDORIA_CSV];
    const linhasTr = dados.map((v) => {
      const celulas = headers
        .map((col) => `<td>${this.escapeHtmlBasico(this.valorParaPipeExport(v, col))}</td>`)
        .join('');
      return `<tr>${celulas}</tr>`;
    });

    const linhaCabecalho = `<tr>${headers.map((h) => `<th>${this.escapeHtmlBasico(h)}</th>`).join('')}</tr>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><table border="1">${linhaCabecalho}${linhasTr.join('')}</table></body></html>`;

    const bom = '\uFEFF';
    const blob = new Blob([bom + html], {
      type: 'application/vnd.ms-excel',
    });
    this.dispararDownload(blob, `ouvidoria-${this.dataArquivoExport()}.xls`);
  }

  private dataArquivoExport(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private dispararDownload(blob: Blob, nomeArquivo: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeHtmlBasico(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escaparCelulaPipe(valor: string): string {
    const precisa =
      valor.includes('|') || valor.includes('"') || valor.includes('\n') || valor.includes('\r');
    if (!precisa) return valor;
    return `"${valor.replace(/"/g, '""')}"`;
  }

  private valorParaPipeExport(v: OuvidoriaItem, col: string): string {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '';
    if (col === 'dt_manifestacao') {
      const d =
        typeof raw === 'string'
          ? new Date(raw)
          : raw instanceof Date
            ? raw
            : new Date(String(raw));
      if (Number.isNaN(d.getTime())) return String(raw).trim();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (col === 'fl_indicador') {
      if (typeof raw === 'boolean') return raw ? 'True' : 'False';
      const s = String(raw).trim().toLowerCase();
      if (s === 'true' || s === '1') return 'True';
      if (s === 'false' || s === '0') return 'False';
      return String(raw).trim();
    }
    return String(raw).trim();
  }

  async importarCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.erro = '';
    this.mensagemImportacao = '';
    this.importandoCsv = true;
    this.cdr.markForCheck();

    try {
      const texto = await this.lerArquivoTexto(file);
      const registros = this.parseConteudoOuvidoriaArquivo(texto);
      if (!registros.length) {
        this.importandoCsv = false;
        this.erro = 'Arquivo vazio ou sem registros válidos.';
        input.value = '';
        this.cdr.markForCheck();
        return;
      }

      const chaves = Object.keys(registros[0]).map((h) => this.normalizarCabecalhoCsv(h));
      const faltando = (CAMPOS_OUVIDORIA_CSV as readonly string[]).filter((c) => !chaves.includes(c));
      if (faltando.length) {
        this.importandoCsv = false;
        this.erro = `Arquivo inválido: faltam colunas obrigatórias: ${faltando.join(', ')}.`;
        input.value = '';
        this.cdr.markForCheck();
        return;
      }

      this.ouvidoriaService.importarCsv({ registros }).subscribe({
        next: (resp) => {
          this.importandoCsv = false;
          this.mensagemImportacao = resp.message ?? 'Importação concluída.';
          this.cdr.markForCheck();
          this.carregar();
          input.value = '';
        },
        error: (err) => {
          this.importandoCsv = false;
          this.erro = err?.error?.message ?? 'Não foi possível importar o arquivo.';
          input.value = '';
          this.cdr.markForCheck();
        },
      });
    } catch (e) {
      this.importandoCsv = false;
      this.erro =
        e instanceof Error
          ? e.message
          : 'Não foi possível ler o arquivo. Use UTF-8 ou Windows-1252.';
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  /**
   * Dois formatos:
   * 1) Exportação desta tela: uma manifestação por linha, 9 campos separados por `|`.
   * 2) Arquivo oficial (ex. DF): registros colados sem `|` entre o canal e a data da próxima
   *    (ex.: `...|INTERNET01/01/2025 01:51:47|...`). Nesse caso os blocos são separados pelo
   *    padrão `dd/mm/aaaa hh:mm:ss|`.
   */
  private parseConteudoOuvidoriaArquivo(content: string): Record<string, string>[] {
    const texto = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!texto) return [];

    const linhas = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (linhas.length === 0) return [];

    let dadosLinhas = linhas;
    const partesPrimeira = linhas[0].split('|');
    if (
      partesPrimeira.length >= CAMPOS_OUVIDORIA_CSV.length &&
      (CAMPOS_OUVIDORIA_CSV.every(
        (nome, idx) => partesPrimeira[idx]?.trim().toLowerCase() === nome.toLowerCase(),
      ) ||
        CAMPOS_OUVIDORIA_CSV_LEGADO.every(
          (nome, idx) => partesPrimeira[idx]?.trim().toLowerCase() === nome.toLowerCase(),
        ))
    ) {
      dadosLinhas = linhas.slice(1);
    }

    if (dadosLinhas.length === 0) return [];

    const n = CAMPOS_OUVIDORIA_CSV.length;
    const cadaLinhaTemNoveCampos = dadosLinhas.every((ln) => ln.split('|').length === n);
    if (cadaLinhaTemNoveCampos) {
      return dadosLinhas.map((ln) => {
        const partes = ln.split('|');
        const row: Record<string, string> = {};
        for (let j = 0; j < n; j++) {
          row[CAMPOS_OUVIDORIA_CSV[j]] = (partes[j] ?? '').trim();
        }
        return row;
      });
    }

    const payload = dadosLinhas.join('');
    return this.parseFluxoContinuoPorData(payload, n);
  }

  /** Registros colados: cada um começa com data/hora e o primeiro `|` após o timestamp. */
  private parseFluxoContinuoPorData(payload: string, n: number): Record<string, string>[] {
    const re = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\|/g;
    const indices: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(payload)) !== null) {
      indices.push(m.index);
    }
    if (indices.length === 0) {
      throw new Error(
        'Não foi possível localizar registros (esperado início no formato dd/mm/aaaa hh:mm:ss|). Verifique o encoding (UTF-8 ou Windows-1252) e se o arquivo é o export oficial.',
      );
    }

    const todas: Record<string, string>[] = [];
    for (let i = 0; i < indices.length; i++) {
      const ini = indices[i];
      const fim = i + 1 < indices.length ? indices[i + 1] : payload.length;
      const bloco = payload.slice(ini, fim);
      const partes = bloco.split('|');
      if (partes.length !== n) {
        throw new Error(
          `Registro ${i + 1}: após separar por "|" foram encontrados ${partes.length} campos (esperado ${n}).`,
        );
      }
      const row: Record<string, string> = {};
      for (let j = 0; j < n; j++) {
        row[CAMPOS_OUVIDORIA_CSV[j]] = (partes[j] ?? '').trim();
      }
      todas.push(row);
    }
    return todas;
  }

  agendarRecomputarPesquisa(): void {
    this.paginaAtual = 1;
    if (this.pesquisaDebounceHandle != null) {
      clearTimeout(this.pesquisaDebounceHandle);
    }
    this.pesquisaDebounceHandle = setTimeout(() => {
      this.pesquisaDebounceHandle = null;
      this.termoBuscaAplicado = this.termoPesquisa.trim().toLowerCase();
      this.recomputarFiltradoEOrdenado();
    }, 300);
  }

  alternarOrdenacao(col: string): void {
    if (!this.ordenacao || this.ordenacao.col !== col) {
      this.ordenacao = { col, dir: 'asc' };
    } else if (this.ordenacao.dir === 'asc') {
      this.ordenacao = { col, dir: 'desc' };
    } else {
      this.ordenacao = null;
    }
    this.paginaAtual = 1;
    this.recomputarFiltradoEOrdenado();
  }

  ordenacaoAriaSort(col: string): 'ascending' | 'descending' | 'none' {
    if (this.ordenacao?.col !== col) return 'none';
    return this.ordenacao.dir === 'asc' ? 'ascending' : 'descending';
  }

  tituloOrdenacaoColuna(col: string): string {
    const titulo = this.tituloColuna(col);
    if (this.ordenacao?.col !== col) {
      return `Ordenar por ${titulo}: crescente`;
    }
    if (this.ordenacao.dir === 'asc') {
      return `Ordenar por ${titulo}: decrescente`;
    }
    return 'Voltar à ordem original dos dados';
  }

  ordenacaoAtivaPara(col: string, dir: 'asc' | 'desc'): boolean {
    return this.ordenacao !== null && this.ordenacao.col === col && this.ordenacao.dir === dir;
  }

  private compararOrdenacao(a: OuvidoriaItem, b: OuvidoriaItem): number {
    const col = this.ordenacao!.col;
    const dir = this.ordenacao!.dir === 'asc' ? 1 : -1;

    if (COLUNAS_ORDENACAO_DATA.has(col)) {
      const na = this.parseDataOrdenacao(a)?.getTime() ?? NaN;
      const nb = this.parseDataOrdenacao(b)?.getTime() ?? NaN;
      const vazioA = Number.isNaN(na);
      const vazioB = Number.isNaN(nb);
      if (vazioA && vazioB) return this.desempateOrdenacaoPorId(a, b);
      if (vazioA) return 1;
      if (vazioB) return -1;
      if (na !== nb) {
        return na < nb ? -dir : dir;
      }
      return this.desempateOrdenacaoPorId(a, b);
    }

    if (COLUNAS_ORDENACAO_BOOLEANA.has(col)) {
      const ba = this.parseBoolOrdenacao(a, col);
      const bb = this.parseBoolOrdenacao(b, col);
      if (ba === null && bb === null) return this.desempateOrdenacaoPorId(a, b);
      if (ba === null) return 1;
      if (bb === null) return -1;
      if (ba !== bb) {
        return ba < bb ? -dir : dir;
      }
      return this.desempateOrdenacaoPorId(a, b);
    }

    const ta = this.textoOrdenacao(a, col);
    const tb = this.textoOrdenacao(b, col);
    const cmp = ta.localeCompare(tb, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) {
      return cmp * dir;
    }
    return this.desempateOrdenacaoPorId(a, b);
  }

  private parseDataOrdenacao(v: OuvidoriaItem): Date | null {
    const raw = v.dt_manifestacao;
    if (raw == null) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private parseBoolOrdenacao(v: OuvidoriaItem, col: string): boolean | null {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return null;
  }

  private textoOrdenacao(v: OuvidoriaItem, col: string): string {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    return String(raw).trim();
  }

  private desempateOrdenacaoPorId(a: OuvidoriaItem, b: OuvidoriaItem): number {
    return (a.id ?? 0) - (b.id ?? 0);
  }

  @HostListener('document:click', ['$event'])
  fecharPainelFiltroSeFora(ev: MouseEvent): void {
    const alvo = ev.target as HTMLElement | null;
    if (
      !alvo?.closest?.('.filtro-col-wrap') &&
      !alvo?.closest?.('.filtro-dropdown-panel--portal')
    ) {
      this.fecharPainelFiltro();
    }
    if (!alvo?.closest?.('.exportar-wrap') && this.menuExportarAberto) {
      this.menuExportarAberto = false;
      this.cdr.markForCheck();
    }
  }

  private fecharPainelFiltro(): void {
    if (this.colunaFiltroAberta === null && this.painelFiltroEstilo === null) {
      return;
    }
    this.colunaFiltroAberta = null;
    this.painelFiltroEstilo = null;
    this.filtroTriggerEl = null;
    this.termoBuscaFiltro = '';
    this.cdr.markForCheck();
  }

  private posicionarPainelFiltro(): void {
    const trigger = this.filtroTriggerEl;
    if (!trigger || !this.colunaFiltroAberta) {
      return;
    }
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margem = 8;
    const panelWidth = Math.min(288, vw - margem * 2);
    let left = r.left;
    if (left + panelWidth > vw - margem) {
      left = vw - margem - panelWidth;
    }
    if (left < margem) {
      left = margem;
    }

    const espacoAbaixo = vh - r.bottom - margem;
    const espacoAcima = r.top - margem;
    let top: number;
    let maxPainel: number;

    if (espacoAbaixo >= 180 || espacoAbaixo >= espacoAcima) {
      top = r.bottom + 4;
      maxPainel = Math.min(280, Math.max(100, espacoAbaixo - 4));
    } else {
      maxPainel = Math.min(280, Math.max(100, espacoAcima - 4));
      top = r.top - 4 - maxPainel;
    }

    if (top < margem) {
      maxPainel = Math.max(80, maxPainel - (margem - top));
      top = margem;
    }

    this.painelFiltroEstilo = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${maxPainel}px`,
      zIndex: '5000',
    };
    this.cdr.markForCheck();
  }

  rotuloOpcaoFiltro(chave: string): string {
    return chave === CHAVE_VAZIO ? '(vazio)' : chave;
  }

  opcoesFiltroParaColuna(col: string): string[] {
    return this.opcoesDistintasPorColuna[col] ?? [];
  }

  /** Opções do painel atual filtradas pelo texto de busca (rótulo ou chave). */
  opcoesFiltroFiltradas(col: string): string[] {
    const todas = this.opcoesFiltroParaColuna(col);
    const q = this.termoBuscaFiltro.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter((chave) => {
      const rotulo = this.rotuloOpcaoFiltro(chave).toLowerCase();
      return rotulo.includes(q) || chave.toLowerCase().includes(q);
    });
  }

  aoAlterarBuscaFiltro(): void {
    this.cdr.markForCheck();
  }

  painelFiltroAbertoPara(col: string): boolean {
    return this.colunaFiltroAberta === col;
  }

  alternarPainelFiltro(col: string, ev: MouseEvent): void {
    ev.stopPropagation();
    const btn = ev.currentTarget as HTMLElement;
    if (this.colunaFiltroAberta === col) {
      this.fecharPainelFiltro();
      return;
    }
    this.colunaFiltroAberta = col;
    this.termoBuscaFiltro = '';
    this.filtroTriggerEl = btn;
    if (this.opcoesDistintasPorColuna[col] === undefined && this.itens.length > 0) {
      this.atualizarOpcoesDistintasParaColuna(col);
    }
    setTimeout(() => {
      this.posicionarPainelFiltro();
      requestAnimationFrame(() => {
        this.posicionarPainelFiltro();
      });
      document.querySelector<HTMLInputElement>('.filtro-dropdown-busca-input')?.focus();
    });
    this.cdr.markForCheck();
  }

  colunaComFiltroAtivo(col: string): boolean {
    return (this.filtrosColuna[col]?.length ?? 0) > 0;
  }

  resumoFiltroColuna(col: string): string {
    const sel = this.filtrosColuna[col];
    const opts = this.opcoesFiltroParaColuna(col);
    const total = opts.length;
    if (!sel?.length) {
      return 'Todos';
    }
    if (total > 0 && sel.length === total) {
      return 'Todos';
    }
    return `${sel.length} selec.`;
  }

  opcaoFiltroMarcada(col: string, chave: string): boolean {
    return this.filtrosColuna[col]?.includes(chave) ?? false;
  }

  alternarOpcaoFiltro(col: string, chave: string): void {
    const atual = [...(this.filtrosColuna[col] ?? [])];
    const i = atual.indexOf(chave);
    if (i >= 0) {
      atual.splice(i, 1);
    } else {
      atual.push(chave);
    }
    const todas = this.opcoesFiltroParaColuna(col);
    if (atual.length === 0 || atual.length === todas.length) {
      delete this.filtrosColuna[col];
    } else {
      this.filtrosColuna[col] = atual;
    }
    this.paginaAtual = 1;
    this.recomputarFiltradoEOrdenado();
  }

  limparFiltroColuna(col: string, ev: MouseEvent): void {
    ev.stopPropagation();
    delete this.filtrosColuna[col];
    this.paginaAtual = 1;
    this.recomputarFiltradoEOrdenado();
  }

  /** Opções distintas de uma coluna (carregadas sob demanda ao abrir o painel do filtro). */
  private atualizarOpcoesDistintasParaColuna(col: string): void {
    const set = new Set<string>();
    for (const v of this.itens) {
      set.add(this.valorChaveFiltro(v, col));
    }
    const vals = Array.from(set).sort((a, b) => {
      if (a === CHAVE_VAZIO) return -1;
      if (b === CHAVE_VAZIO) return 1;
      if (col === 'dt_manifestacao') {
        const na = /^\d{4}$/.test(a) ? Number.parseInt(a, 10) : NaN;
        const nb = /^\d{4}$/.test(b) ? Number.parseInt(b, 10) : NaN;
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          return nb - na;
        }
      }
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
    this.opcoesDistintasPorColuna = { ...this.opcoesDistintasPorColuna, [col]: vals };
  }

  private passouFiltrosColuna(v: OuvidoriaItem): boolean {
    for (const col of this.colunasExibicao) {
      const selecionados = this.filtrosColuna[col];
      if (!selecionados?.length) continue;
      const chave = this.valorChaveFiltro(v, col);
      if (!selecionados.includes(chave)) {
        return false;
      }
    }
    return true;
  }

  valorChaveFiltro(v: OuvidoriaItem, col: string): string {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return CHAVE_VAZIO;
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    if (typeof raw === 'string' && !raw.trim()) return CHAVE_VAZIO;
    if (col === 'dt_manifestacao') {
      const d = this.parseDataOrdenacao(v);
      if (d) return String(d.getFullYear());
      const rawStr = row[col];
      if (typeof rawStr === 'string' && rawStr.trim()) return rawStr.trim();
      return CHAVE_VAZIO;
    }
    if (typeof raw === 'number') return String(raw);
    const s = String(raw).trim();
    return s.length ? s : CHAVE_VAZIO;
  }

  aoAlterarItensPorPagina(): void {
    this.paginaAtual = 1;
    this.atualizarPaginaSlice();
  }

  paginaAnterior(): void {
    if (this.paginaAtual > 1) {
      this.paginaAtual -= 1;
      this.atualizarPaginaSlice();
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual < this.totalPaginas) {
      this.paginaAtual += 1;
      this.atualizarPaginaSlice();
    }
  }

  irParaPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaAtual = pagina;
    this.atualizarPaginaSlice();
  }

  valorCelula(v: OuvidoriaItem, col: string): string | number | null {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '—';
    if (col === 'dt_manifestacao') {
      const d =
        raw instanceof Date ? raw : typeof raw === 'string' ? new Date(raw) : new Date(String(raw));
      if (Number.isNaN(d.getTime())) {
        return typeof raw === 'string' ? raw.trim() : '—';
      }
      return d.toLocaleDateString('pt-BR');
    }
    if (col === 'fl_indicador') {
      if (typeof raw === 'boolean') return raw ? 'Sim' : 'Não';
      return String(raw).trim() || '—';
    }
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    return s.length ? s : '—';
  }

  private textoLinha(v: OuvidoriaItem): string {
    const row = v as unknown as Record<string, unknown>;
    const partes = [String(v.id ?? '')];
    for (const c of CAMPOS_OUVIDORIA_CSV as readonly string[]) {
      const val = row[c];
      partes.push(val != null ? String(val) : '');
    }
    return partes.join(' ').toLowerCase();
  }

  private normalizarCabecalhoCsv(value: string): string {
    return String(value ?? '')
      .replace(/^\uFEFF/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
  }

  private async lerArquivoTexto(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('\uFFFD')) return utf8;
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
