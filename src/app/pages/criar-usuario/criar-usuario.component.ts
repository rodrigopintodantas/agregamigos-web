import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';
import {
  BairroComPessoasItem,
  PapelItem,
  UsuarioGrupoResumo,
  UsuarioListagemItem,
  UsuarioService,
} from '../../service/usuario.service';

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
  carregandoUsuarios = true;
  carregandoBairros = true;
  carregandoGrupos = true;
  salvando = false;
  erro = '';
  erroLista = '';
  erroBairros = '';
  erroGrupos = '';
  sucesso = '';
  papeis: PapelItem[] = [];
  usuarios: UsuarioListagemItem[] = [];
  bairrosDisponiveis: BairroComPessoasItem[] = [];
  gruposDisponiveis: UsuarioGrupoResumo[] = [];

  bairroPainelUsuarioId: number | null = null;
  bairroPainelEstilo: Record<string, string> | null = null;
  termoBuscaBairro = '';
  salvandoBairrosUsuarioId: number | null = null;
  erroBairrosPorUsuario: Record<number, string> = {};

  grupoPainelUsuarioId: number | null = null;
  grupoPainelEstilo: Record<string, string> | null = null;
  termoBuscaGrupo = '';
  salvandoGruposUsuarioId: number | null = null;
  erroGruposPorUsuario: Record<number, string> = {};

  private bairroPainelTriggerEl: HTMLElement | null = null;
  private grupoPainelTriggerEl: HTMLElement | null = null;

  form = {
    nome: '',
    login: '',
    email: '',
    senha: '',
    papel_id: null as number | null,
  };

  ngOnInit(): void {
    this.carregarPapeis();
    this.carregarUsuarios();
    this.carregarBairrosDisponiveis();
    this.carregarGruposDisponiveis();
  }

  @HostListener('document:click')
  fecharPaineisAoClicarFora(): void {
    this.fecharPainelBairro();
    this.fecharPainelGrupo();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  reposicionarPaineis(): void {
    if (this.bairroPainelUsuarioId != null && this.bairroPainelTriggerEl) {
      this.posicionarPainelBairro();
    }
    if (this.grupoPainelUsuarioId != null && this.grupoPainelTriggerEl) {
      this.posicionarPainelGrupo();
    }
  }

  get usuarioPainelBairro(): UsuarioListagemItem | null {
    if (this.bairroPainelUsuarioId == null) return null;
    return this.usuarios.find((u) => u.id === this.bairroPainelUsuarioId) ?? null;
  }

  get usuarioPainelGrupo(): UsuarioListagemItem | null {
    if (this.grupoPainelUsuarioId == null) return null;
    return this.usuarios.find((u) => u.id === this.grupoPainelUsuarioId) ?? null;
  }

  get papeisSelecionaveis(): PapelItem[] {
    const semUsuario = this.papeis.filter((p) => p.nome !== 'Usuario');
    if (this.auth.isLoginAdminSistema()) return semUsuario;
    return semUsuario.filter((p) => p.nome !== 'Administrador');
  }

  private papelPadraoFormulario(): PapelItem | null {
    const lista = this.papeisSelecionaveis;
    return lista.find((p) => p.nome === 'Coordenador') ?? lista[0] ?? null;
  }

  ehCoordenador(usuario: UsuarioListagemItem): boolean {
    return usuario.papel.nome === 'Coordenador';
  }

  podeVincularBairroOuGrupo(usuario: UsuarioListagemItem): boolean {
    return usuario.papel.nome === 'Coordenador' || usuario.papel.nome === 'Administrador';
  }

  carregarBairrosDisponiveis(): void {
    this.carregandoBairros = true;
    this.erroBairros = '';
    this.usuarioService.listarBairrosComPessoas().subscribe({
      next: (bairros) => {
        this.bairrosDisponiveis = bairros;
        this.carregandoBairros = false;
      },
      error: (err) => {
        this.erroBairros = err?.error?.message ?? 'Não foi possível carregar os bairros.';
        this.carregandoBairros = false;
      },
    });
  }

  carregarGruposDisponiveis(): void {
    this.carregandoGrupos = true;
    this.erroGrupos = '';
    this.usuarioService.listarGruposDisponiveis().subscribe({
      next: (grupos) => {
        this.gruposDisponiveis = grupos;
        this.carregandoGrupos = false;
      },
      error: (err) => {
        this.erroGrupos = err?.error?.message ?? 'Não foi possível carregar os grupos.';
        this.carregandoGrupos = false;
      },
    });
  }

  carregarUsuarios(): void {
    this.carregandoUsuarios = true;
    this.erroLista = '';
    this.usuarioService.listar().subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios
          .filter((u) => u.login.trim().toLowerCase() !== 'admin')
          .map((u) => ({
            ...u,
            bairros: u.bairros ?? [],
            grupos: u.grupos ?? [],
          }));
        this.carregandoUsuarios = false;
      },
      error: (err) => {
        this.erroLista = err?.error?.message ?? 'Não foi possível carregar os usuários.';
        this.carregandoUsuarios = false;
      },
    });
  }

  carregarPapeis(): void {
    this.carregandoPapeis = true;
    this.usuarioService.listarPapeis().subscribe({
      next: (papeis) => {
        this.papeis = papeis;
        const papelPadrao = this.papelPadraoFormulario();
        this.form.papel_id = papelPadrao?.id ?? null;
        this.carregandoPapeis = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os perfis.';
        this.carregandoPapeis = false;
      },
    });
  }

  resumoBairros(usuario: UsuarioListagemItem): string {
    const total = this.bairrosDisponiveis.length;
    const selecionados = usuario.bairros?.length ?? 0;
    if (!selecionados) return 'Nenhum';
    if (total > 0 && selecionados === total) return 'Todos';
    if (selecionados === 1) return usuario.bairros![0];
    return `${selecionados} selec.`;
  }

  resumoGrupos(usuario: UsuarioListagemItem): string {
    const total = this.gruposDisponiveis.length;
    const selecionados = usuario.grupos?.length ?? 0;
    if (!selecionados) return 'Nenhum';
    if (total > 0 && selecionados === total) return 'Todos';
    if (selecionados === 1) return usuario.grupos![0].nome;
    return `${selecionados} selec.`;
  }

  painelBairroAbertoPara(usuario: UsuarioListagemItem): boolean {
    return this.bairroPainelUsuarioId === usuario.id;
  }

  painelGrupoAbertoPara(usuario: UsuarioListagemItem): boolean {
    return this.grupoPainelUsuarioId === usuario.id;
  }

  bairroMarcado(usuario: UsuarioListagemItem, bairro: string): boolean {
    return usuario.bairros?.includes(bairro) ?? false;
  }

  grupoMarcado(usuario: UsuarioListagemItem, grupoId: number): boolean {
    return usuario.grupos?.some((g) => g.id === grupoId) ?? false;
  }

  opcoesBairroFiltradas(): BairroComPessoasItem[] {
    const q = this.termoBuscaBairro.trim().toLowerCase();
    if (!q) return this.bairrosDisponiveis;
    return this.bairrosDisponiveis.filter((item) => item.bairro.toLowerCase().includes(q));
  }

  opcoesGrupoFiltradas(): UsuarioGrupoResumo[] {
    const q = this.termoBuscaGrupo.trim().toLowerCase();
    if (!q) return this.gruposDisponiveis;
    return this.gruposDisponiveis.filter((item) => item.nome.toLowerCase().includes(q));
  }

  alternarPainelBairro(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    if (!this.podeVincularBairroOuGrupo(usuario)) return;

    const btn = ev.currentTarget as HTMLElement;
    if (this.bairroPainelUsuarioId === usuario.id) {
      this.fecharPainelBairro();
      return;
    }

    this.fecharPainelGrupo();
    this.bairroPainelUsuarioId = usuario.id;
    this.termoBuscaBairro = '';
    this.bairroPainelTriggerEl = btn;
    setTimeout(() => {
      this.posicionarPainelBairro();
      requestAnimationFrame(() => this.posicionarPainelBairro());
      document.querySelector<HTMLInputElement>('.cu-bairro-panel .filtro-dropdown-busca-input')?.focus();
    });
  }

  alternarPainelGrupo(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    if (!this.podeVincularBairroOuGrupo(usuario)) return;

    const btn = ev.currentTarget as HTMLElement;
    if (this.grupoPainelUsuarioId === usuario.id) {
      this.fecharPainelGrupo();
      return;
    }

    this.fecharPainelBairro();
    this.grupoPainelUsuarioId = usuario.id;
    this.termoBuscaGrupo = '';
    this.grupoPainelTriggerEl = btn;
    setTimeout(() => {
      this.posicionarPainelGrupo();
      requestAnimationFrame(() => this.posicionarPainelGrupo());
      document.querySelector<HTMLInputElement>('.cu-grupo-panel .filtro-dropdown-busca-input')?.focus();
    });
  }

  alternarBairroUsuario(usuario: UsuarioListagemItem, bairro: string): void {
    const atual = [...(usuario.bairros ?? [])];
    const idx = atual.indexOf(bairro);
    const proximo =
      idx >= 0
        ? atual.filter((item) => item !== bairro)
        : [...atual, bairro].sort((a, b) => a.localeCompare(b, 'pt'));
    this.persistirBairros(usuario, proximo);
  }

  alternarGrupoUsuario(usuario: UsuarioListagemItem, grupo: UsuarioGrupoResumo): void {
    const atual = [...(usuario.grupos ?? [])];
    const idx = atual.findIndex((g) => g.id === grupo.id);
    const proximo =
      idx >= 0
        ? atual.filter((g) => g.id !== grupo.id)
        : [...atual, grupo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    this.persistirGrupos(usuario, proximo);
  }

  limparBairrosUsuario(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    this.persistirBairros(usuario, []);
  }

  limparGruposUsuario(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    this.persistirGrupos(usuario, []);
  }

  private persistirBairros(usuario: UsuarioListagemItem, bairros: string[]): void {
    const anterior = [...(usuario.bairros ?? [])];
    usuario.bairros = bairros;
    this.salvandoBairrosUsuarioId = usuario.id;
    delete this.erroBairrosPorUsuario[usuario.id];

    this.usuarioService.salvarBairrosUsuario(usuario.id, bairros).subscribe({
      next: (resp) => {
        usuario.bairros = resp.bairros;
        this.salvandoBairrosUsuarioId = null;
      },
      error: (err) => {
        usuario.bairros = anterior;
        this.salvandoBairrosUsuarioId = null;
        this.erroBairrosPorUsuario[usuario.id] =
          err?.error?.message ?? 'Não foi possível salvar os bairros.';
      },
    });
  }

  private persistirGrupos(usuario: UsuarioListagemItem, grupos: UsuarioGrupoResumo[]): void {
    const anterior = [...(usuario.grupos ?? [])];
    usuario.grupos = grupos;
    this.salvandoGruposUsuarioId = usuario.id;
    delete this.erroGruposPorUsuario[usuario.id];

    this.usuarioService.salvarGruposUsuario(usuario.id, grupos.map((g) => g.id)).subscribe({
      next: (resp) => {
        usuario.grupos = resp.grupos;
        this.salvandoGruposUsuarioId = null;
      },
      error: (err) => {
        usuario.grupos = anterior;
        this.salvandoGruposUsuarioId = null;
        this.erroGruposPorUsuario[usuario.id] =
          err?.error?.message ?? 'Não foi possível salvar os grupos.';
      },
    });
  }

  private fecharPainelBairro(): void {
    this.bairroPainelUsuarioId = null;
    this.bairroPainelEstilo = null;
    this.bairroPainelTriggerEl = null;
    this.termoBuscaBairro = '';
  }

  private fecharPainelGrupo(): void {
    this.grupoPainelUsuarioId = null;
    this.grupoPainelEstilo = null;
    this.grupoPainelTriggerEl = null;
    this.termoBuscaGrupo = '';
  }

  private posicionarPainelFlutuante(
    trigger: HTMLElement,
  ): Record<string, string> {
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

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${maxPainel}px`,
      zIndex: '1200',
    };
  }

  private posicionarPainelBairro(): void {
    const trigger = this.bairroPainelTriggerEl;
    if (!trigger || this.bairroPainelUsuarioId == null) return;
    this.bairroPainelEstilo = this.posicionarPainelFlutuante(trigger);
  }

  private posicionarPainelGrupo(): void {
    const trigger = this.grupoPainelTriggerEl;
    if (!trigger || this.grupoPainelUsuarioId == null) return;
    this.grupoPainelEstilo = this.posicionarPainelFlutuante(trigger);
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
          const papelPadrao = this.papelPadraoFormulario();
          this.form.papel_id = papelPadrao?.id ?? null;
          this.carregarUsuarios();
        },
        error: (err) => {
          this.salvando = false;
          this.erro = err?.error?.message ?? 'Não foi possível criar o usuário.';
        },
      });
  }
}
