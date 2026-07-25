import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { PessoaService } from '../../service/pessoa.service';
import { WhatsappService } from '../../service/whatsapp.service';
import {
  GrupoCoordenadorResumo,
  GrupoDetalhe,
  GrupoItem,
  GrupoService,
} from '../../service/grupo.service';
import {
  lerArquivoTextoCsv,
  normalizarCabecalhoCsv,
  parseCsvPessoa,
  possuiColunaNomeCsv,
  possuiColunaTelefoneCsv,
  prepararTelefonesCsv,
} from '../../utils/importar-csv-pessoa.util';

@Component({
  selector: 'app-grupo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grupo.component.html',
  styleUrl: './grupo.component.scss',
})
export class GrupoComponent implements OnInit {
  auth = inject(AutenticacaoService);
  private grupoService = inject(GrupoService);
  private pessoaService = inject(PessoaService);
  private whatsappService = inject(WhatsappService);
  private router = inject(Router);

  carregando = true;
  salvando = false;
  carregandoDetalhe = false;
  erro = '';
  sucesso = '';

  grupos: GrupoItem[] = [];
  coordenadores: GrupoCoordenadorResumo[] = [];

  exibindoCriacao = false;
  form = {
    nome: '',
    descricao: '',
    id_coordenadores: [] as number[],
  };

  dialogDetalheAberto = false;
  grupoDetalhe: GrupoDetalhe | null = null;
  linkCopiado = false;
  encerrandoGrupoId: number | null = null;
  excluindoGrupoId: number | null = null;
  importandoCsvGrupo = false;
  sucessoImportacaoCsv = '';
  erroImportacaoCsv = '';
  sufixoCoordenadorLinkGrupo = '';
  whatsappConectado = false;

  ngOnInit(): void {
    this.carregarGrupos();
    this.carregarCoordenadores();
    this.carregarSufixoCoordenadorLinkGrupo();
    this.carregarStatusWhatsapp();
  }

  private carregarStatusWhatsapp(): void {
    this.whatsappService.listarCanais().subscribe({
      next: (lista) => {
        this.whatsappConectado = lista.some((c) => c.conectado === true);
      },
      error: () => {
        this.whatsappConectado = false;
      },
    });
  }

  criarCampanhaDivulgacao(grupo: GrupoItem): void {
    if (!this.whatsappConectado || !this.auth.isAdmin()) return;
    void this.router.navigate(this.auth.routerSegments('admin', 'divulgacao'), {
      queryParams: {
        grupo_campanha: '1',
        grupo_id: grupo.id,
        grupo_nome: grupo.nome,
      },
    });
  }

  tituloBotaoCampanhaDivulgacao(): string {
    if (this.whatsappConectado) {
      return 'Criar Campanha de Divulgação';
    }
    return 'Conecte um celular em WhatsApp para criar campanhas de divulgação';
  }

  private carregarSufixoCoordenadorLinkGrupo(): void {
    if (!this.auth.isCoordenador()) {
      this.sufixoCoordenadorLinkGrupo = '';
      return;
    }
    const id = this.auth.getUsuario()?.id;
    const legado = id != null ? `&coordenador=${encodeURIComponent(String(id))}` : '';

    this.auth.obterChaveDivulgacaoLinkCadastro().subscribe({
      next: ({ chave_publica }) => {
        this.sufixoCoordenadorLinkGrupo = chave_publica ? `&${chave_publica}` : legado;
      },
      error: () => {
        this.sufixoCoordenadorLinkGrupo = legado;
      },
    });
  }

  carregarGrupos(): void {
    this.carregando = true;
    this.erro = '';
    this.grupoService.listar().subscribe({
      next: (lista) => {
        this.grupos = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os grupos.';
        this.carregando = false;
      },
    });
  }

  carregarCoordenadores(): void {
    this.grupoService.listarCoordenadores().subscribe({
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
    this.form = {
      nome: '',
      descricao: '',
      id_coordenadores: [],
    };
  }

  cancelarCriacao(): void {
    this.exibindoCriacao = false;
  }

  salvarGrupo(): void {
    this.erro = '';
    this.sucesso = '';
    if (this.form.nome.trim().length < 3) {
      this.erro = 'Informe o nome do grupo com pelo menos 3 caracteres.';
      return;
    }

    this.salvando = true;
    this.grupoService
      .criar({
        nome: this.form.nome.trim(),
        descricao: this.form.descricao.trim() || null,
        id_coordenadores: this.form.id_coordenadores,
      })
      .subscribe({
        next: (ret) => {
          this.salvando = false;
          this.sucesso = ret.message ?? 'Grupo criado com sucesso.';
          this.exibindoCriacao = false;
          this.carregarGrupos();
        },
        error: (err) => {
          this.salvando = false;
          this.erro = err?.error?.message ?? 'Não foi possível criar o grupo.';
        },
      });
  }

  detalharGrupo(grupo: GrupoItem): void {
    this.erro = '';
    this.linkCopiado = false;
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.dialogDetalheAberto = true;
    this.grupoDetalhe = null;
    this.carregandoDetalhe = true;

    this.grupoService.detalhe(grupo.id).subscribe({
      next: (det) => {
        this.grupoDetalhe = det;
        this.carregandoDetalhe = false;
      },
      error: (err) => {
        this.carregandoDetalhe = false;
        this.dialogDetalheAberto = false;
        this.erro = err?.error?.message ?? 'Não foi possível carregar o detalhe do grupo.';
      },
    });
  }

  fecharDetalhe(): void {
    this.dialogDetalheAberto = false;
    this.grupoDetalhe = null;
    this.linkCopiado = false;
    this.encerrandoGrupoId = null;
    this.excluindoGrupoId = null;
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.importandoCsvGrupo = false;
  }

  abrirSeletorCsvGrupo(input: HTMLInputElement): void {
    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    input.click();
  }

  private recarregarDetalheGrupo(grupoId: number): void {
    this.carregandoDetalhe = true;
    this.grupoService.detalhe(grupoId).subscribe({
      next: (det) => {
        this.grupoDetalhe = det;
        this.carregandoDetalhe = false;
        this.carregarGrupos();
      },
      error: (err) => {
        this.carregandoDetalhe = false;
        this.erroImportacaoCsv = err?.error?.message ?? 'Não foi possível atualizar o detalhe do grupo.';
      },
    });
  }

  async importarCsvGrupo(event: Event): Promise<void> {
    const det = this.grupoDetalhe;
    if (!det) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.sucessoImportacaoCsv = '';
    this.erroImportacaoCsv = '';
    this.importandoCsvGrupo = true;

    try {
      const csv = await lerArquivoTextoCsv(file);
      const registros = parseCsvPessoa(csv);
      if (!registros.length) {
        this.importandoCsvGrupo = false;
        this.erroImportacaoCsv = 'CSV vazio ou sem linhas válidas.';
        input.value = '';
        return;
      }

      const headers = Object.keys(registros[0]).map((h) => normalizarCabecalhoCsv(h));
      if (!possuiColunaNomeCsv(headers)) {
        this.importandoCsvGrupo = false;
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
          this.importandoCsvGrupo = false;
          input.value = '';
          return;
        }
      }

      prepararTelefonesCsv(registros);

      this.pessoaService.importarCsv({ registros, grupo_id: det.id }).subscribe({
        next: (resp) => {
          this.importandoCsvGrupo = false;
          this.sucessoImportacaoCsv = resp.message ?? 'CSV importado com sucesso.';
          this.recarregarDetalheGrupo(det.id);
          input.value = '';
        },
        error: (err) => {
          this.importandoCsvGrupo = false;
          this.erroImportacaoCsv = err?.error?.message ?? 'Não foi possível importar o CSV.';
          input.value = '';
        },
      });
    } catch {
      this.importandoCsvGrupo = false;
      this.erroImportacaoCsv = 'Não foi possível ler o arquivo CSV.';
      input.value = '';
    }
  }

  encerrarGrupo(grupo: GrupoItem): void {
    if (grupo.status !== 'ativo') return;
    this.erro = '';
    this.sucesso = '';
    this.encerrandoGrupoId = grupo.id;
    this.grupoService.alterarStatus(grupo.id, 'encerrado').subscribe({
      next: (ret) => {
        this.encerrandoGrupoId = null;
        this.sucesso = ret.message ?? 'Grupo encerrado com sucesso.';
        if (this.grupoDetalhe?.id === grupo.id) {
          this.grupoDetalhe = { ...this.grupoDetalhe, status: 'encerrado' };
        }
        this.carregarGrupos();
      },
      error: (err) => {
        this.encerrandoGrupoId = null;
        this.erro = err?.error?.message ?? 'Não foi possível encerrar o grupo.';
      },
    });
  }

  excluirGrupo(grupo: GrupoItem): void {
    const ok = window.confirm(
      `Excluir o grupo "${grupo.nome}"?\n\nAs pessoas cadastradas pelo link permanecem no sistema; apenas o vínculo com o grupo é removido.`,
    );
    if (!ok) return;

    this.erro = '';
    this.sucesso = '';
    this.excluindoGrupoId = grupo.id;
    this.grupoService.excluir(grupo.id).subscribe({
      next: (ret) => {
        this.excluindoGrupoId = null;
        this.sucesso = ret.message ?? 'Grupo excluído com sucesso.';
        if (this.grupoDetalhe?.id === grupo.id) {
          this.fecharDetalhe();
        }
        this.carregarGrupos();
      },
      error: (err) => {
        this.excluindoGrupoId = null;
        this.erro = err?.error?.message ?? 'Não foi possível excluir o grupo.';
      },
    });
  }

  nomeCoordenadorLinkGrupo(): string {
    const nome = this.auth.getUsuario()?.nome?.trim();
    if (nome) return nome;
    return this.auth.getUserLogin()?.trim() || '—';
  }

  linkCadastroAbsoluto(det: GrupoDetalhe): string {
    const path = det.link_cadastro_path;
    if (!path) return '';
    const sufixo = this.auth.isCoordenador() ? this.sufixoCoordenadorLinkGrupo : '';
    const pathComCoord = `${path}${sufixo}`;
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
      const origin = (globalThis as unknown as { location: { origin: string } }).location.origin;
      return `${origin}${pathComCoord}`;
    }
    return pathComCoord;
  }

  async copiarLinkCadastro(): Promise<void> {
    const det = this.grupoDetalhe;
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

  nomesCoordenadores(grupo: { coordenadores?: GrupoCoordenadorResumo[] }): string {
    const lista = grupo.coordenadores ?? [];
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
