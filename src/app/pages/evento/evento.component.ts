import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BAIRROS_DISTRITO_FEDERAL } from '../../data/bairros-distrito-federal';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { PessoaService } from '../../service/pessoa.service';
import {
  EventoCoordenadorResumo,
  EventoDetalhe,
  EventoItem,
  EventoService,
} from '../../service/evento.service';
import {
  lerArquivoTextoCsv,
  normalizarCabecalhoCsv,
  parseCsvPessoa,
  possuiColunaNomeCsv,
  possuiColunaTelefoneCsv,
  prepararTelefonesCsv,
} from '../../utils/importar-csv-pessoa.util';

@Component({
  selector: 'app-evento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evento.component.html',
  styleUrl: './evento.component.scss',
})
export class EventoComponent implements OnInit {
  auth = inject(AutenticacaoService);
  private eventoService = inject(EventoService);
  private pessoaService = inject(PessoaService);

  carregando = true;
  salvando = false;
  carregandoDetalhe = false;
  erro = '';
  sucesso = '';

  eventos: EventoItem[] = [];
  coordenadores: EventoCoordenadorResumo[] = [];
  readonly bairrosDistritoFederal = [...BAIRROS_DISTRITO_FEDERAL];

  exibindoCriacao = false;
  form = {
    nome: '',
    descricao: '',
    data_evento: '',
    locais: [] as string[],
    id_coordenadores: [] as number[],
  };

  dialogDetalheAberto = false;
  eventoDetalhe: EventoDetalhe | null = null;
  linkCopiado = false;
  encerrandoEventoId: number | null = null;
  excluindoEventoId: number | null = null;
  dropdownLocaisAberto = false;
  buscaLocal = '';
  importandoCsvEvento = false;
  sucessoImportacaoCsv = '';
  erroImportacaoCsv = '';
  /** Sufixo do link de cadastro do evento para o coordenador logado (`&chave` ou `&coordenador=id`). */
  sufixoCoordenadorLinkEvento = '';

  ngOnInit(): void {
    this.carregarEventos();
    this.carregarCoordenadores();
    this.carregarSufixoCoordenadorLinkEvento();
  }

  private carregarSufixoCoordenadorLinkEvento(): void {
    if (!this.auth.isCoordenador()) {
      this.sufixoCoordenadorLinkEvento = '';
      return;
    }
    const id = this.auth.getUsuario()?.id;
    const legado =
      id != null ? `&coordenador=${encodeURIComponent(String(id))}` : '';

    this.auth.obterChaveDivulgacaoLinkCadastro().subscribe({
      next: ({ chave_publica }) => {
        this.sufixoCoordenadorLinkEvento = chave_publica ? `&${chave_publica}` : legado;
      },
      error: () => {
        this.sufixoCoordenadorLinkEvento = legado;
      },
    });
  }

  carregarEventos(): void {
    this.carregando = true;
    this.erro = '';
    this.eventoService.listar().subscribe({
      next: (lista) => {
        this.eventos = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os eventos.';
        this.carregando = false;
      },
    });
  }

  carregarCoordenadores(): void {
    this.eventoService.listarCoordenadores().subscribe({
      next: (ret) => {
        this.coordenadores = ret.coordenadores ?? [];
      },
      error: () => {
        this.coordenadores = [];
      },
    });
  }

  abrirCriacao(): void {
    this.exibindoCriacao = true;
    this.erro = '';
    this.sucesso = '';
    this.dropdownLocaisAberto = false;
    this.buscaLocal = '';
    this.form = {
      nome: '',
      descricao: '',
      data_evento: '',
      locais: [] as string[],
      id_coordenadores: [],
    };
  }

  cancelarCriacao(): void {
    this.exibindoCriacao = false;
    this.dropdownLocaisAberto = false;
    this.buscaLocal = '';
  }

  @HostListener('document:click', ['$event'])
  fecharDropdownLocaisAoClicarFora(event: MouseEvent): void {
    const alvo = event.target as HTMLElement | null;
    if (!alvo?.closest?.('.dropdown-locais-wrap')) {
      this.dropdownLocaisAberto = false;
    }
  }

  alternarDropdownLocais(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownLocaisAberto = !this.dropdownLocaisAberto;
    if (this.dropdownLocaisAberto) {
      this.buscaLocal = '';
    }
  }

  localSelecionado(bairro: string): boolean {
    return this.form.locais.includes(bairro);
  }

  alternarLocal(bairro: string, selecionado: boolean): void {
    if (selecionado) {
      if (!this.form.locais.includes(bairro)) {
        this.form.locais = [...this.form.locais, bairro];
      }
      return;
    }
    this.form.locais = this.form.locais.filter((item) => item !== bairro);
  }

  limparLocais(event: MouseEvent): void {
    event.stopPropagation();
    this.form.locais = [];
  }

  bairrosLocalFiltrados(): string[] {
    const termo = this.buscaLocal.trim().toLowerCase();
    if (!termo) return this.bairrosDistritoFederal;
    return this.bairrosDistritoFederal.filter((b) => b.toLowerCase().includes(termo));
  }

  resumoLocais(): string {
    const qtd = this.form.locais.length;
    if (!qtd) return 'Selecione um ou mais bairros';
    if (qtd === 1) return this.form.locais[0];
    if (qtd === 2) return `${this.form.locais[0]}, ${this.form.locais[1]}`;
    return `${qtd} bairros selecionados`;
  }

  salvarEvento(): void {
    this.erro = '';
    this.sucesso = '';
    if (this.form.nome.trim().length < 3) {
      this.erro = 'Informe o nome do evento com pelo menos 3 caracteres.';
      return;
    }

    this.salvando = true;
    this.eventoService
      .criar({
        nome: this.form.nome.trim(),
        descricao: this.form.descricao.trim() || null,
        data_evento: this.form.data_evento || null,
        locais: this.form.locais.length ? [...this.form.locais] : undefined,
        id_coordenadores: this.form.id_coordenadores,
      })
      .subscribe({
        next: (ret) => {
          this.salvando = false;
          this.sucesso = ret.message ?? 'Evento criado com sucesso.';
          this.exibindoCriacao = false;
          this.carregarEventos();
        },
        error: (err) => {
          this.salvando = false;
          this.erro = err?.error?.message ?? 'Não foi possível criar o evento.';
        },
      });
  }

  detalharEvento(evento: EventoItem): void {
    this.erro = '';
    this.linkCopiado = false;
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.dialogDetalheAberto = true;
    this.eventoDetalhe = null;
    this.carregandoDetalhe = true;

    this.eventoService.detalhe(evento.id).subscribe({
      next: (det) => {
        this.eventoDetalhe = det;
        this.carregandoDetalhe = false;
      },
      error: (err) => {
        this.carregandoDetalhe = false;
        this.dialogDetalheAberto = false;
        this.erro = err?.error?.message ?? 'Não foi possível carregar o detalhe do evento.';
      },
    });
  }

  fecharDetalhe(): void {
    this.dialogDetalheAberto = false;
    this.eventoDetalhe = null;
    this.linkCopiado = false;
    this.encerrandoEventoId = null;
    this.excluindoEventoId = null;
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.importandoCsvEvento = false;
  }

  abrirSeletorCsvEvento(input: HTMLInputElement): void {
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    input.click();
  }

  private recarregarDetalheEvento(eventoId: number): void {
    this.carregandoDetalhe = true;
    this.eventoService.detalhe(eventoId).subscribe({
      next: (det) => {
        this.eventoDetalhe = det;
        this.carregandoDetalhe = false;
        this.carregarEventos();
      },
      error: (err) => {
        this.carregandoDetalhe = false;
        this.erroImportacaoCsv = err?.error?.message ?? 'Não foi possível atualizar o detalhe do evento.';
      },
    });
  }

  async importarCsvEvento(event: Event): Promise<void> {
    const det = this.eventoDetalhe;
    if (!det) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.importandoCsvEvento = true;

    try {
      const csv = await lerArquivoTextoCsv(file);
      const registros = parseCsvPessoa(csv);
      if (!registros.length) {
        this.importandoCsvEvento = false;
        this.erroImportacaoCsv = 'CSV vazio ou sem linhas válidas.';
        input.value = '';
        return;
      }

      const headers = Object.keys(registros[0]).map((h) => normalizarCabecalhoCsv(h));
      if (!possuiColunaNomeCsv(headers)) {
        this.importandoCsvEvento = false;
        this.erroImportacaoCsv =
          "CSV inválido: coluna de nome não encontrada. Use 'Nome Completo:' (ou variações como 'nome' e 'nome_completo').";
        input.value = '';
        return;
      }

      if (!possuiColunaTelefoneCsv(headers)) {
        const continuar = window.confirm(
          'Não foi encontrada uma coluna de telefone/WhatsApp neste CSV (ex.: "Telefone com DDD", "Celular", "WhatsApp").\n\nSe continuar, os cadastros serão importados sem telefone.\n\nDeseja continuar mesmo assim?',
        );
        if (!continuar) {
          this.importandoCsvEvento = false;
          input.value = '';
          return;
        }
      }

      prepararTelefonesCsv(registros);

      this.pessoaService.importarCsv({ registros, evento_id: det.id }).subscribe({
        next: (resp) => {
          this.importandoCsvEvento = false;
          this.sucessoImportacaoCsv = resp.message ?? 'CSV importado com sucesso.';
          this.recarregarDetalheEvento(det.id);
          input.value = '';
        },
        error: (err) => {
          this.importandoCsvEvento = false;
          this.erroImportacaoCsv = err?.error?.message ?? 'Não foi possível importar o CSV.';
          input.value = '';
        },
      });
    } catch {
      this.importandoCsvEvento = false;
      this.erroImportacaoCsv = 'Não foi possível ler o arquivo CSV.';
      input.value = '';
    }
  }

  encerrarEvento(evento: EventoItem): void {
    if (evento.status !== 'ativo') return;
    this.erro = '';
    this.sucesso = '';
    this.encerrandoEventoId = evento.id;
    this.eventoService.alterarStatus(evento.id, 'encerrado').subscribe({
      next: (ret) => {
        this.encerrandoEventoId = null;
        this.sucesso = ret.message ?? 'Evento encerrado com sucesso.';
        if (this.eventoDetalhe?.id === evento.id) {
          this.eventoDetalhe = { ...this.eventoDetalhe, status: 'encerrado' };
        }
        this.carregarEventos();
      },
      error: (err) => {
        this.encerrandoEventoId = null;
        this.erro = err?.error?.message ?? 'Não foi possível encerrar o evento.';
      },
    });
  }

  excluirEvento(evento: EventoItem): void {
    const ok = window.confirm(
      `Excluir o evento "${evento.nome}"?\n\nAs pessoas cadastradas pelo link permanecem no sistema, com o vínculo ao coordenador preservado.`,
    );
    if (!ok) return;

    this.erro = '';
    this.sucesso = '';
    this.excluindoEventoId = evento.id;
    this.eventoService.excluir(evento.id).subscribe({
      next: (ret) => {
        this.excluindoEventoId = null;
        this.sucesso = ret.message ?? 'Evento excluído com sucesso.';
        if (this.eventoDetalhe?.id === evento.id) {
          this.fecharDetalhe();
        }
        this.carregarEventos();
      },
      error: (err) => {
        this.excluindoEventoId = null;
        this.erro = err?.error?.message ?? 'Não foi possível excluir o evento.';
      },
    });
  }

  nomeCoordenadorLinkEvento(): string {
    const nome = this.auth.getUsuario()?.nome?.trim();
    if (nome) return nome;
    return this.auth.getUserLogin()?.trim() || '—';
  }

  linkCadastroAbsoluto(det: EventoDetalhe): string {
    const path = det.link_cadastro_path;
    if (!path) return '';
    const sufixo = this.auth.isCoordenador() ? this.sufixoCoordenadorLinkEvento : '';
    const pathComCoord = `${path}${sufixo}`;
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
      const origin = (globalThis as unknown as { location: { origin: string } }).location.origin;
      return `${origin}${pathComCoord}`;
    }
    return pathComCoord;
  }

  async copiarLinkCadastro(): Promise<void> {
    const det = this.eventoDetalhe;
    if (!det) return;
    const url = this.linkCadastroAbsoluto(det);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopiado = true;
    } catch {
      this.erro = 'Não foi possível copiar o link. Copie manualmente.';
    }
  }

  coordenadorSelecionado(id: number): boolean {
    return this.form.id_coordenadores.includes(id);
  }

  alternarCoordenador(id: number, selecionado: boolean): void {
    if (selecionado) {
      if (!this.form.id_coordenadores.includes(id)) {
        this.form.id_coordenadores = [...this.form.id_coordenadores, id];
      }
      return;
    }
    this.form.id_coordenadores = this.form.id_coordenadores.filter((x) => x !== id);
  }

  nomesCoordenadores(evento: { coordenadores?: EventoCoordenadorResumo[] }): string {
    const lista = evento.coordenadores ?? [];
    if (!lista.length) return '—';
    return lista.map((c) => c.nome).join(', ');
  }

  labelStatus(status: string): string {
    switch (status) {
      case 'ativo':
        return 'Ativo';
      case 'encerrado':
        return 'Encerrado';
      default:
        return status;
    }
  }
}
