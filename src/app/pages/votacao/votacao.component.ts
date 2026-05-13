import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { VotacaoItem, VotacaoService } from '../../service/votacao.service';
import { ZonaEleitoral, ZonasEleitoraisService } from '../../service/zonas-eleitorais.service';

/** Cabeçalhos esperados no CSV (iguais às colunas da tabela `votacao`, exceto id e timestamps). */
export const CABECALHOS_CSV_VOTACAO = [
  'sg_uf',
  'nr_zona',
  'cd_cargo',
  'ds_cargo',
  'nr_candidato',
  'nm_candidato',
  'nm_urna_candidato',
  'sg_partido',
  'ds_composicao_coligacao',
  'nr_turno',
  'ds_sit_totalizacao',
  'nm_tipo_destinacao_votos',
  'dt_ult_totalizacao',
  'pc_votos_validos',
  'qt_votos_nom_validos',
  'qt_votos_concorrentes',
] as const;

const COLUNAS_OCULTAS_NA_TABELA = new Set([
  'sg_uf',
  'cd_cargo',
  'dt_ult_totalizacao',
  'pc_votos_validos',
  'nm_candidato',
]);

/** Colunas ordenadas numericamente (demais: texto). */
const COLUNAS_ORDENACAO_NUMERICA = new Set([
  'nr_candidato',
  'nr_turno',
  'qt_votos_nom_validos',
  'qt_votos_concorrentes',
]);

/** Ordenação inicial ao carregar / após novo CSV. */
const ORDENACAO_PADRAO = { col: 'qt_votos_nom_validos', dir: 'desc' as const };

/** Valor sintético para células vazias nos filtros por coluna. */
const CHAVE_VAZIO = '__vazio__';

@Component({
  selector: 'app-votacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './votacao.component.html',
  styleUrl: './votacao.component.scss',
})
export class VotacaoComponent implements OnInit, OnDestroy {
  private votacaoService = inject(VotacaoService);
  private zonasEleitoraisService = inject(ZonasEleitoraisService);

  /** nr_zona → nm_zona (tabela zonas_eleitorais). */
  private mapaNmZonaPorNr = new Map<number, string>();

  /** Estilos inline do painel de filtro ancorado na viewport (fora do overflow da tabela). */
  painelFiltroEstilo: Record<string, string> | null = null;
  /** Botão que abriu o painel (para recalcular posição em scroll/resize). */
  private filtroTriggerEl: HTMLElement | null = null;
  private readonly reposicionarPainel = (): void => {
    if (this.colunaFiltroAberta && this.filtroTriggerEl) {
      this.posicionarPainelFiltro();
    }
  };

  /** Colunas exibidas na grade (CSV continua exigindo o cabeçalho completo). */
  readonly colunasExibicao = (CABECALHOS_CSV_VOTACAO as readonly string[]).filter(
    (c) => !COLUNAS_OCULTAS_NA_TABELA.has(c),
  );

  votacoes: VotacaoItem[] = [];
  /** Opções distintas por coluna (chaves normalizadas), atualizadas ao carregar dados. */
  opcoesDistintasPorColuna: Record<string, string[]> = {};
  /** Por coluna: valores selecionados no filtro; vazio ou ausente = sem filtro nessa coluna. */
  filtrosColuna: Record<string, string[]> = {};
  /** Qual painel de filtro está aberto (nome da coluna). */
  colunaFiltroAberta: string | null = null;
  /** Texto da busca dentro do painel de filtro (refina a lista de checkboxes). */
  termoBuscaFiltro = '';

  /** Ordenação aplicada sobre os registros filtrados; null = ordem original da API. */
  ordenacao: { col: string; dir: 'asc' | 'desc' } | null = {
    col: ORDENACAO_PADRAO.col,
    dir: ORDENACAO_PADRAO.dir,
  };

  termoPesquisa = '';
  carregando = true;
  erro = '';
  importandoCsv = false;
  mensagemImportacao = '';
  /** Menu Exportar (CSV / Excel). */
  menuExportarAberto = false;

  /** Aba da página: visão completa (grade atual) ou por zona. */
  abaVotacao: 'completa' | 'por-zona' = 'completa';

  /** Catálogo de zonas (API) para o dropdown da aba Por Zona. */
  zonasEleitoraisLista: ZonaEleitoral[] = [];
  /** Zona escolhida na aba Por Zona (nr_zona). */
  nrZonaSelecionadaPorZona: number | null = null;
  readonly itensPorPaginaPorZona = 5;
  paginaPorZonaCandidatos = 1;
  paginaPorZonaColigacoes = 1;

  paginaAtual = 1;
  itensPorPagina = 10;
  readonly opcoesItensPorPagina = [10, 20, 50, 100];

  ngOnInit(): void {
    this.carregar();
    window.addEventListener('scroll', this.reposicionarPainel, true);
    window.addEventListener('resize', this.reposicionarPainel);
  }

  ngOnDestroy(): void {
    this.fecharPainelFiltro();
    this.menuExportarAberto = false;
    window.removeEventListener('scroll', this.reposicionarPainel, true);
    window.removeEventListener('resize', this.reposicionarPainel);
  }

  get votacoesFiltradas(): VotacaoItem[] {
    let lista = this.votacoes.filter((v) => this.passouFiltrosColuna(v));
    const termo = this.termoPesquisa.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((item) => this.textoLinha(item).includes(termo));
    }
    return lista;
  }

  /** Lista já filtrada + ordenação opcional (usada na paginação). */
  get votacoesFiltradasOrdenadas(): VotacaoItem[] {
    const base = this.votacoesFiltradas;
    if (!this.ordenacao) {
      return base;
    }
    return [...base].sort((a, b) => this.compararOrdenacao(a, b));
  }

  get totalPaginas(): number {
    const total = Math.ceil(this.votacoesFiltradas.length / this.itensPorPagina);
    return Math.max(total, 1);
  }

  get votacoesPaginadas(): VotacaoItem[] {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    return this.votacoesFiltradasOrdenadas.slice(inicio, fim);
  }

  get paginasVisiveis(): number[] {
    const maxBotoes = 5;
    const total = this.totalPaginas;
    if (total <= maxBotoes) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const metade = Math.floor(maxBotoes / 2);
    let inicio = this.paginaAtual - metade;
    let fim = this.paginaAtual + metade;

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
    forkJoin({
      votos: this.votacaoService.listar(),
      zonas: this.zonasEleitoraisService.listar(),
    }).subscribe({
      next: ({ votos, zonas }) => {
        this.votacoes = votos;
        this.zonasEleitoraisLista = [...zonas].sort((a, b) => a.nr_zona - b.nr_zona);
        this.mapaNmZonaPorNr = new Map(zonas.map((z) => [z.nr_zona, z.nm_zona]));
        this.filtrosColuna = {};
        this.ordenacao = { col: ORDENACAO_PADRAO.col, dir: ORDENACAO_PADRAO.dir };
        this.fecharPainelFiltro();
        this.atualizarOpcoesDistintas();
        this.paginaAtual = 1;
        this.sincronizarSelecaoZonaPorZona();
        this.carregando = false;
      },
      error: (err) => {
        this.erro =
          err?.error?.message ??
          'Não foi possível carregar os dados de votação ou as zonas eleitorais.';
        this.carregando = false;
      },
    });
  }

  /** Título da coluna na grade (nr_zona exibe como nm_zona). */
  tituloColuna(col: string): string {
    return col === 'nr_zona' ? 'nm_zona' : col;
  }

  definirAba(aba: 'completa' | 'por-zona'): void {
    if (this.abaVotacao === aba) return;
    this.abaVotacao = aba;
    if (aba !== 'completa') {
      this.fecharPainelFiltro();
      this.fecharMenuExportar();
    }
  }

  definirZonaPorZona(nr: number): void {
    this.nrZonaSelecionadaPorZona = nr;
    this.paginaPorZonaCandidatos = 1;
    this.paginaPorZonaColigacoes = 1;
  }

  /** Primeira zona com dados na votação; senão a primeira do catálogo. */
  private sincronizarSelecaoZonaPorZona(): void {
    const ordenadas = this.zonasEleitoraisLista;
    if (!ordenadas.length) {
      this.nrZonaSelecionadaPorZona = null;
      return;
    }
    const comDados = new Set(
      this.votacoes.map((v) => v.nr_zona).filter((n): n is number => n != null),
    );
    const primeiraComDados = ordenadas.find((z) => comDados.has(z.nr_zona));
    this.nrZonaSelecionadaPorZona = primeiraComDados?.nr_zona ?? ordenadas[0].nr_zona;
    this.paginaPorZonaCandidatos = 1;
    this.paginaPorZonaColigacoes = 1;
  }

  parseQtVotosNom(v: VotacaoItem): number {
    const raw = v.qt_votos_nom_validos;
    if (raw === undefined || raw === null) return 0;
    const s = String(raw).replace(/\./g, '').replace(/\s/g, '').replace(',', '.').trim();
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  formatarNumeroPtBr(n: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
  }

  get votacoesDaZonaSelecionada(): VotacaoItem[] {
    const nz = this.nrZonaSelecionadaPorZona;
    if (nz == null) return [];
    return this.votacoes.filter((v) => v.nr_zona === nz);
  }

  /** Linhas da zona, ordenadas por qt_votos_nom_validos decrescente. */
  get candidatosZonaOrdenados(): VotacaoItem[] {
    return [...this.votacoesDaZonaSelecionada].sort(
      (a, b) => this.parseQtVotosNom(b) - this.parseQtVotosNom(a),
    );
  }

  get candidatosZonaPaginados(): VotacaoItem[] {
    const inicio = (this.paginaPorZonaCandidatos - 1) * this.itensPorPaginaPorZona;
    return this.candidatosZonaOrdenados.slice(inicio, inicio + this.itensPorPaginaPorZona);
  }

  get totalPaginasPorZonaCandidatos(): number {
    const n = this.candidatosZonaOrdenados.length;
    return Math.max(1, Math.ceil(n / this.itensPorPaginaPorZona));
  }

  get paginasVisiveisPorZonaCandidatos(): number[] {
    return this.calcPaginasVisiveis(this.paginaPorZonaCandidatos, this.totalPaginasPorZonaCandidatos);
  }

  get agregadoColigacoesPorZona(): { ds: string; total: number }[] {
    const map = new Map<string, number>();
    for (const v of this.votacoesDaZonaSelecionada) {
      const key = (v.ds_composicao_coligacao ?? '').trim() || '(sem composição)';
      map.set(key, (map.get(key) ?? 0) + this.parseQtVotosNom(v));
    }
    return [...map.entries()]
      .map(([ds, total]) => ({ ds, total }))
      .sort((a, b) => b.total - a.total);
  }

  get coligacoesZonaPaginadas(): { ds: string; total: number }[] {
    const inicio = (this.paginaPorZonaColigacoes - 1) * this.itensPorPaginaPorZona;
    return this.agregadoColigacoesPorZona.slice(inicio, inicio + this.itensPorPaginaPorZona);
  }

  get totalPaginasPorZonaColigacoes(): number {
    const n = this.agregadoColigacoesPorZona.length;
    return Math.max(1, Math.ceil(n / this.itensPorPaginaPorZona));
  }

  get paginasVisiveisPorZonaColigacoes(): number[] {
    return this.calcPaginasVisiveis(this.paginaPorZonaColigacoes, this.totalPaginasPorZonaColigacoes);
  }

  private calcPaginasVisiveis(paginaAtual: number, totalPaginas: number): number[] {
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

  paginaAnteriorPorZonaCandidatos(): void {
    if (this.paginaPorZonaCandidatos > 1) this.paginaPorZonaCandidatos -= 1;
  }

  proximaPaginaPorZonaCandidatos(): void {
    if (this.paginaPorZonaCandidatos < this.totalPaginasPorZonaCandidatos) {
      this.paginaPorZonaCandidatos += 1;
    }
  }

  irPaginaPorZonaCandidatos(p: number): void {
    if (p < 1 || p > this.totalPaginasPorZonaCandidatos) return;
    this.paginaPorZonaCandidatos = p;
  }

  paginaAnteriorPorZonaColigacoes(): void {
    if (this.paginaPorZonaColigacoes > 1) this.paginaPorZonaColigacoes -= 1;
  }

  proximaPaginaPorZonaColigacoes(): void {
    if (this.paginaPorZonaColigacoes < this.totalPaginasPorZonaColigacoes) {
      this.paginaPorZonaColigacoes += 1;
    }
  }

  irPaginaPorZonaColigacoes(p: number): void {
    if (p < 1 || p > this.totalPaginasPorZonaColigacoes) return;
    this.paginaPorZonaColigacoes = p;
  }

  textoUrnaPorZona(v: VotacaoItem): string {
    const s = v.nm_urna_candidato?.trim();
    return s?.length ? s : '—';
  }

  abrirSeletorCsv(input: HTMLInputElement): void {
    this.mensagemImportacao = '';
    input.click();
  }

  alternarMenuExportar(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuExportarAberto = !this.menuExportarAberto;
  }

  fecharMenuExportar(): void {
    this.menuExportarAberto = false;
  }

  exportarPara(formato: 'csv' | 'xls'): void {
    if (formato === 'csv') {
      this.exportarCsvArquivo();
    } else {
      this.exportarXlsArquivo();
    }
    this.fecharMenuExportar();
  }

  /** Exporta CSV — mesmo formato do import. */
  private exportarCsvArquivo(): void {
    const dados = this.votacoesFiltradasOrdenadas;
    if (!dados.length) return;

    const headers = [...CABECALHOS_CSV_VOTACAO];
    const linhas: string[] = [];
    linhas.push(headers.map((h) => this.escaparCelulaCsv(h)).join(','));
    for (const v of dados) {
      const cells = headers.map((col) => this.escaparCelulaCsv(this.valorParaCsvExport(v, col)));
      linhas.push(cells.join(','));
    }

    const bom = '\uFEFF';
    const blob = new Blob([bom + linhas.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    this.dispararDownload(blob, `votacao-${this.dataArquivoExport()}.csv`);
  }

  /** Exporta planilha HTML compatível com Excel (.xls). */
  private exportarXlsArquivo(): void {
    const dados = this.votacoesFiltradasOrdenadas;
    if (!dados.length) return;

    const headers = [...CABECALHOS_CSV_VOTACAO];
    const linhasTr = dados.map((v) => {
      const celulas = headers
        .map((col) => `<td>${this.escapeHtmlBasico(this.valorParaCsvExport(v, col))}</td>`)
        .join('');
      return `<tr>${celulas}</tr>`;
    });

    const linhaCabecalho = `<tr>${headers.map((h) => `<th>${this.escapeHtmlBasico(h)}</th>`).join('')}</tr>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><table border="1">${linhaCabecalho}${linhasTr.join('')}</table></body></html>`;

    const bom = '\uFEFF';
    const blob = new Blob([bom + html], {
      type: 'application/vnd.ms-excel',
    });
    this.dispararDownload(blob, `votacao-${this.dataArquivoExport()}.xls`);
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

  private escaparCelulaCsv(valor: string): string {
    const precisa =
      valor.includes(',') || valor.includes('"') || valor.includes('\n') || valor.includes('\r');
    if (!precisa) return valor;
    return `"${valor.replace(/"/g, '""')}"`;
  }

  private valorParaCsvExport(v: VotacaoItem, col: string): string {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '';
    if (col === 'dt_ult_totalizacao') {
      const d =
        typeof raw === 'string'
          ? new Date(raw)
          : raw instanceof Date
            ? raw
            : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw).trim() : d.toISOString();
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

    try {
      const csv = await this.lerArquivoTexto(file);
      const registros = this.parseCsv(csv);
      if (!registros.length) {
        this.importandoCsv = false;
        this.erro = 'CSV vazio ou sem linhas válidas.';
        input.value = '';
        return;
      }

      const chaves = Object.keys(registros[0]).map((h) => this.normalizarCabecalhoCsv(h));
      const faltando = (CABECALHOS_CSV_VOTACAO as readonly string[]).filter((c) => !chaves.includes(c));
      if (faltando.length) {
        this.importandoCsv = false;
        this.erro = `CSV inválido: faltam colunas obrigatórias: ${faltando.join(', ')}.`;
        input.value = '';
        return;
      }

      this.votacaoService.importarCsv({ registros }).subscribe({
        next: (resp) => {
          this.importandoCsv = false;
          this.mensagemImportacao = resp.message ?? 'CSV importado com sucesso.';
          this.carregar();
          input.value = '';
        },
        error: (err) => {
          this.importandoCsv = false;
          this.erro = err?.error?.message ?? 'Não foi possível importar o CSV.';
          input.value = '';
        },
      });
    } catch {
      this.importandoCsv = false;
      this.erro = 'Não foi possível ler o arquivo CSV.';
      input.value = '';
    }
  }

  aoAlterarPesquisa(): void {
    this.paginaAtual = 1;
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

  private compararOrdenacao(a: VotacaoItem, b: VotacaoItem): number {
    const col = this.ordenacao!.col;
    const dir = this.ordenacao!.dir === 'asc' ? 1 : -1;

    if (COLUNAS_ORDENACAO_NUMERICA.has(col)) {
      const na = this.parseNumeroOrdenacao(a, col);
      const nb = this.parseNumeroOrdenacao(b, col);
      const vazioA = na === null;
      const vazioB = nb === null;
      if (vazioA && vazioB) return this.desempateOrdenacaoPorId(a, b);
      if (vazioA) return 1;
      if (vazioB) return -1;
      if (na !== nb) {
        return na < nb ? -dir : dir;
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

  private parseNumeroOrdenacao(v: VotacaoItem, col: string): number | null {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : null;
    }
    const s = String(raw).trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private textoOrdenacao(v: VotacaoItem, col: string): string {
    if (col === 'nr_zona') {
      return this.nmZonaExibicao(v);
    }
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '';
    return String(raw).trim();
  }

  /** Texto da zona para exibição / ordenação / filtro (nome oficial ou número). */
  private nmZonaExibicao(v: VotacaoItem): string {
    const nz = v.nr_zona;
    if (nz == null) return '';
    return this.mapaNmZonaPorNr.get(nz) ?? String(nz);
  }

  private desempateOrdenacaoPorId(a: VotacaoItem, b: VotacaoItem): number {
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
    if (!alvo?.closest?.('.exportar-wrap')) {
      this.menuExportarAberto = false;
    }
  }

  private fecharPainelFiltro(): void {
    this.colunaFiltroAberta = null;
    this.painelFiltroEstilo = null;
    this.filtroTriggerEl = null;
    this.termoBuscaFiltro = '';
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
    setTimeout(() => {
      this.posicionarPainelFiltro();
      requestAnimationFrame(() => this.posicionarPainelFiltro());
      document.querySelector<HTMLInputElement>('.filtro-dropdown-busca-input')?.focus();
    });
  }

  colunaComFiltroAtivo(col: string): boolean {
    return (this.filtrosColuna[col]?.length ?? 0) > 0;
  }

  resumoFiltroColuna(col: string): string {
    const sel = this.filtrosColuna[col];
    const total = this.opcoesFiltroParaColuna(col).length;
    if (!sel?.length) {
      return 'Todos';
    }
    if (sel.length === total) {
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
  }

  limparFiltroColuna(col: string, ev: MouseEvent): void {
    ev.stopPropagation();
    delete this.filtrosColuna[col];
    this.paginaAtual = 1;
  }

  private atualizarOpcoesDistintas(): void {
    const map: Record<string, Set<string>> = {};
    for (const col of this.colunasExibicao) {
      map[col] = new Set<string>();
    }
    for (const v of this.votacoes) {
      for (const col of this.colunasExibicao) {
        map[col].add(this.valorChaveFiltro(v, col));
      }
    }
    const next: Record<string, string[]> = {};
    for (const col of this.colunasExibicao) {
      const vals = Array.from(map[col]).sort((a, b) => {
        if (a === CHAVE_VAZIO) return -1;
        if (b === CHAVE_VAZIO) return 1;
        return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      next[col] = vals;
    }
    this.opcoesDistintasPorColuna = next;
  }

  private passouFiltrosColuna(v: VotacaoItem): boolean {
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

  /** Chave estável do valor da célula para agrupar / filtrar (alinha à lógica de exibição). */
  valorChaveFiltro(v: VotacaoItem, col: string): string {
    if (col === 'nr_zona') {
      const nz = v.nr_zona;
      if (nz == null) return CHAVE_VAZIO;
      const nm = this.mapaNmZonaPorNr.get(nz);
      return nm ?? String(nz);
    }
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return CHAVE_VAZIO;
    if (typeof raw === 'string' && !raw.trim()) return CHAVE_VAZIO;
    if (col === 'dt_ult_totalizacao' && typeof raw === 'string') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('pt-BR');
    }
    if (typeof raw === 'number') return String(raw);
    const s = String(raw).trim();
    return s.length ? s : CHAVE_VAZIO;
  }

  aoAlterarItensPorPagina(): void {
    this.paginaAtual = 1;
  }

  paginaAnterior(): void {
    if (this.paginaAtual > 1) {
      this.paginaAtual -= 1;
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual < this.totalPaginas) {
      this.paginaAtual += 1;
    }
  }

  irParaPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaAtual = pagina;
  }

  valorCelula(v: VotacaoItem, col: string): string | number | null {
    if (col === 'nr_zona') {
      const nz = v.nr_zona;
      if (nz == null) return '—';
      return this.mapaNmZonaPorNr.get(nz) ?? String(nz);
    }
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '—';
    if (col === 'dt_ult_totalizacao' && typeof raw === 'string') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('pt-BR');
    }
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    return s.length ? s : '—';
  }

  private textoLinha(v: VotacaoItem): string {
    const row = v as unknown as Record<string, unknown>;
    const partes = [String(v.id ?? '')];
    for (const c of CABECALHOS_CSV_VOTACAO as readonly string[]) {
      const val = row[c];
      partes.push(val != null ? String(val) : '');
    }
    const nm = this.nmZonaExibicao(v);
    if (nm) {
      partes.push(nm);
    }
    return partes.join(' ').toLowerCase();
  }

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const tabCount = lines[0].match(/\t/g)?.length ?? 0;
    const semicolonCount = lines[0].match(/;/g)?.length ?? 0;
    const commaCount = lines[0].match(/,/g)?.length ?? 0;
    const separator =
      tabCount >= semicolonCount && tabCount >= commaCount ? '\t' : semicolonCount > commaCount ? ';' : ',';
    const headers = this.parseCsvLine(lines[0], separator).map((h) => this.sanitizarCabecalhoCsv(h));

    return lines.slice(1).map((line) => {
      const values = this.parseCsvLine(line, separator);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });
  }

  private parseCsvLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === separator && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private normalizarCabecalhoCsv(value: string): string {
    return String(value ?? '')
      .replace(/^\uFEFF/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
  }

  private sanitizarCabecalhoCsv(value: string): string {
    return String(value ?? '')
      .replace(/^\uFEFF/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  private async lerArquivoTexto(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('\uFFFD')) return utf8;
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
