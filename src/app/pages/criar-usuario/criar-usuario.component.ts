import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';
import {
  BairroComPessoasItem,
  PapelItem,
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
  salvando = false;
  erro = '';
  erroLista = '';
  erroBairros = '';
  sucesso = '';
  papeis: PapelItem[] = [];
  usuarios: UsuarioListagemItem[] = [];
  bairrosDisponiveis: BairroComPessoasItem[] = [];

  bairroPainelUsuarioId: number | null = null;
  bairroPainelEstilo: Record<string, string> | null = null;
  termoBuscaBairro = '';
  salvandoBairrosUsuarioId: number | null = null;
  erroBairrosPorUsuario: Record<number, string> = {};

  private bairroPainelTriggerEl: HTMLElement | null = null;

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
  }

  @HostListener('document:click')
  fecharPainelBairroAoClicarFora(): void {
    this.fecharPainelBairro();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  reposicionarPainelBairro(): void {
    if (this.bairroPainelUsuarioId != null && this.bairroPainelTriggerEl) {
      this.posicionarPainelBairro();
    }
  }

  get usuarioPainelBairro(): UsuarioListagemItem | null {
    if (this.bairroPainelUsuarioId == null) return null;
    return this.usuarios.find((u) => u.id === this.bairroPainelUsuarioId) ?? null;
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

  painelBairroAbertoPara(usuario: UsuarioListagemItem): boolean {
    return this.bairroPainelUsuarioId === usuario.id;
  }

  bairroMarcado(usuario: UsuarioListagemItem, bairro: string): boolean {
    return usuario.bairros?.includes(bairro) ?? false;
  }

  opcoesBairroFiltradas(): BairroComPessoasItem[] {
    const q = this.termoBuscaBairro.trim().toLowerCase();
    if (!q) return this.bairrosDisponiveis;
    return this.bairrosDisponiveis.filter((item) => item.bairro.toLowerCase().includes(q));
  }

  alternarPainelBairro(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    if (!this.ehCoordenador(usuario)) return;

    const btn = ev.currentTarget as HTMLElement;
    if (this.bairroPainelUsuarioId === usuario.id) {
      this.fecharPainelBairro();
      return;
    }

    this.bairroPainelUsuarioId = usuario.id;
    this.termoBuscaBairro = '';
    this.bairroPainelTriggerEl = btn;
    setTimeout(() => {
      this.posicionarPainelBairro();
      requestAnimationFrame(() => this.posicionarPainelBairro());
      document.querySelector<HTMLInputElement>('.cu-bairro-panel .filtro-dropdown-busca-input')?.focus();
    });
  }

  alternarBairroUsuario(usuario: UsuarioListagemItem, bairro: string): void {
    const atual = [...(usuario.bairros ?? [])];
    const idx = atual.indexOf(bairro);
    const proximo = idx >= 0 ? atual.filter((item) => item !== bairro) : [...atual, bairro].sort((a, b) =>
      a.localeCompare(b, 'pt'),
    );
    this.persistirBairros(usuario, proximo);
  }

  limparBairrosUsuario(usuario: UsuarioListagemItem, ev: MouseEvent): void {
    ev.stopPropagation();
    this.persistirBairros(usuario, []);
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

  private fecharPainelBairro(): void {
    this.bairroPainelUsuarioId = null;
    this.bairroPainelEstilo = null;
    this.bairroPainelTriggerEl = null;
    this.termoBuscaBairro = '';
  }

  private posicionarPainelBairro(): void {
    const trigger = this.bairroPainelTriggerEl;
    if (!trigger || this.bairroPainelUsuarioId == null) return;

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

    this.bairroPainelEstilo = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${maxPainel}px`,
      zIndex: '1200',
    };
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
