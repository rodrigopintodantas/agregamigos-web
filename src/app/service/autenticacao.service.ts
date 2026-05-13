import { HttpClient, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CandidatoResumo } from '../types/candidato.model';
import { Perfil } from '../types/perfil.model';
import { Usuario } from '../types/usuario.model';

const STORAGE_TOKEN = 'accessToken';
const STORAGE_CANDIDATO_SLUG = 'candidatoSlug';
const STORAGE_CANDIDATO_NOME = 'candidatoNome';

type AuthResponse = {
  token: string;
  usuario: Usuario;
  papeis?: Perfil[];
  up?: Perfil[];
  candidatos?: CandidatoResumo[];
};

type AuthPerfilResponse = {
  usuario: Usuario;
  papeis?: Perfil[];
  up?: Perfil[];
  candidatos?: CandidatoResumo[];
};

@Injectable({
  providedIn: 'root',
})
export class AutenticacaoService {
  authenticated = false;
  user: Usuario = {};
  private userLogin: string | null = null;
  private accessToken: string | null = null;

  private apiURL = `${environment.apiUrl}/auth`;
  private http = inject(HttpClient);

  constructor() {
    const storedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem(STORAGE_TOKEN);
    const storedLogin = sessionStorage.getItem('userLogin');
    if (storedUser && token) {
      this.authenticated = true;
      this.user = JSON.parse(storedUser);
      this.accessToken = token;
      this.userLogin = storedLogin ?? this.user.login ?? null;
    }
    this.syncCandidatoDoToken();
  }

  /** Monta caminho absoluto com slug do candidato ativo, ex.: `/michello-bueno/admin/pessoas`. */
  rotaComCandidato(...segments: string[]): string {
    const slug = this.getCandidatoSlug();
    if (!slug) {
      return '/selecionar-candidato';
    }
    const limpos = segments.map((s) => String(s ?? '').replace(/^\/+|\/+$/g, '')).filter((s) => s.length > 0);
    return `/${slug}/${limpos.join('/')}`;
  }

  /** Segmentos para `routerLink`, ex. `['/', 'michello-bueno', 'admin', 'pessoas']`. */
  routerSegments(...parts: string[]): (string | number)[] {
    const slug = this.getCandidatoSlug();
    if (!slug) {
      return ['/selecionar-candidato'];
    }
    return ['/', slug, ...parts];
  }

  getCandidatoSlug(): string | null {
    const s = sessionStorage.getItem(STORAGE_CANDIDATO_SLUG);
    return s ? s.trim().toLowerCase() : null;
  }

  getCandidatoNome(): string | null {
    return sessionStorage.getItem(STORAGE_CANDIDATO_NOME);
  }

  temCandidatoSelecionado(): boolean {
    return !!this.getCandidatoSlug();
  }

  private setCandidatoSessao(slug: string, nome?: string | null): void {
    sessionStorage.setItem(STORAGE_CANDIDATO_SLUG, slug.trim().toLowerCase());
    if (nome) {
      sessionStorage.setItem(STORAGE_CANDIDATO_NOME, nome);
    } else {
      sessionStorage.removeItem(STORAGE_CANDIDATO_NOME);
    }
  }

  private limparCandidatoSessao(): void {
    sessionStorage.removeItem(STORAGE_CANDIDATO_SLUG);
    sessionStorage.removeItem(STORAGE_CANDIDATO_NOME);
  }

  /** Lê `candidato_slug` do JWT (payload não verificado criptograficamente aqui — só exibição). */
  private syncCandidatoDoToken(): void {
    const t = this.getAccessToken();
    if (!t) return;
    const parts = t.split('.');
    if (parts.length < 2) return;
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64)) as { candidato_slug?: string };
      const slug = payload.candidato_slug;
      if (slug && typeof slug === 'string') {
        sessionStorage.setItem(STORAGE_CANDIDATO_SLUG, slug.trim().toLowerCase());
      }
    } catch {
      /* ignore */
    }
  }

  /** Login com senha: grava JWT e dados do usuário (sem contexto de candidato). */
  autenticar(
    login: string,
    senha: string,
  ): Observable<{ token: string; usuario: Usuario; papeis: Perfil[]; candidatos: CandidatoResumo[] }> {
    const obs = new Subject<{
      token: string;
      usuario: Usuario;
      papeis: Perfil[];
      candidatos: CandidatoResumo[];
    }>();
    const url = `${this.apiURL}/login`;
    this.http.post<AuthResponse>(url, { login: login.trim(), senha }).subscribe({
      next: (retorno) => {
        const papeis = this.normalizePapeis(retorno);
        this.limparCandidatoSessao();
        this.accessToken = retorno.token;
        sessionStorage.setItem(STORAGE_TOKEN, retorno.token);
        sessionStorage.setItem('user', JSON.stringify(retorno.usuario));
        if (retorno.usuario.login) {
          sessionStorage.setItem('userLogin', retorno.usuario.login);
        }
        sessionStorage.setItem('profiles', JSON.stringify(papeis));
        this.user = retorno.usuario;
        this.userLogin = retorno.usuario.login ?? null;
        this.authenticated = true;
        if (papeis.length > 0) {
          sessionStorage.setItem('profile', JSON.stringify(papeis[0]));
        }
        const candidatos = retorno.candidatos ?? [];
        obs.next({ token: retorno.token, usuario: retorno.usuario, papeis, candidatos });
        obs.complete();
      },
      error: (err) => obs.error(err),
    });
    return obs.asObservable();
  }

  selecionarCandidato(slug: string): Observable<{ token: string; candidato: CandidatoResumo }> {
    const obs = new Subject<{ token: string; candidato: CandidatoResumo }>();
    this.http
      .post<{ token: string; candidato: CandidatoResumo }>(
        `${this.apiURL}/candidato`,
        { slug: slug.trim().toLowerCase() },
        { headers: { Authorization: `Bearer ${this.getAccessToken()}` } },
      )
      .subscribe({
        next: (ret) => {
          this.accessToken = ret.token;
          sessionStorage.setItem(STORAGE_TOKEN, ret.token);
          this.setCandidatoSessao(ret.candidato.slug, ret.candidato.nome);
          obs.next(ret);
          obs.complete();
        },
        error: (e) => obs.error(e),
      });
    return obs.asObservable();
  }

  logout() {
    this.authenticated = false;
    this.userLogin = null;
    this.accessToken = null;
    this.limparAutenticacao();
  }

  carregarPerfil(): Observable<{ usuario: Usuario; papeis: Perfil[]; candidatos: CandidatoResumo[] }> {
    const obs = new Subject<{ usuario: Usuario; papeis: Perfil[]; candidatos: CandidatoResumo[] }>();

    if (!this.getAccessToken()) {
      obs.error('Usuário não autenticado');
      return obs.asObservable();
    }

    this.http
      .get<AuthPerfilResponse>(this.apiURL, {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`,
        },
      })
      .subscribe({
        next: (retorno) => {
          const papeis = this.normalizePapeis(retorno);
          sessionStorage.setItem('user', JSON.stringify(retorno.usuario));
          sessionStorage.setItem('profiles', JSON.stringify(papeis));
          this.user = retorno.usuario;

          if (papeis.length > 0) {
            sessionStorage.setItem('profile', JSON.stringify(papeis[0]));
          } else {
            const atual = this.getPerfil();
            const idAtual = atual?.id;
            if (idAtual != null) {
              const found = papeis.find((p) => p.id === idAtual);
              if (found) {
                sessionStorage.setItem('profile', JSON.stringify(found));
              }
            }
          }

          this.syncCandidatoDoToken();
          const candidatos = retorno.candidatos ?? [];
          obs.next({ usuario: retorno.usuario, papeis, candidatos });
          obs.complete();
        },
        error: (error) => obs.error(error),
      });

    return obs.asObservable();
  }

  definePerfil(perfil: Perfil | undefined) {
    if (perfil) {
      sessionStorage.setItem('profile', JSON.stringify(perfil));
    }
  }

  limparAutenticacao() {
    sessionStorage.removeItem('profile');
    sessionStorage.removeItem('profiles');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('userLogin');
    sessionStorage.removeItem(STORAGE_TOKEN);
    this.limparCandidatoSessao();
  }

  getPerfil(): Perfil | null {
    const profile = sessionStorage.getItem('profile');
    return profile ? JSON.parse(profile) : null;
  }

  getPerfis(): Perfil[] {
    const profiles = sessionStorage.getItem('profiles');
    return profiles ? JSON.parse(profiles) : [];
  }

  getUsuario(): Usuario {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user) : {};
  }

  getUserLogin(): string | null {
    return this.userLogin || sessionStorage.getItem('userLogin');
  }

  getAccessToken(): string | null {
    return this.accessToken ?? sessionStorage.getItem(STORAGE_TOKEN);
  }

  temPerfil() {
    return !!sessionStorage.getItem('profiles');
  }

  isAdmin() {
    return this.temPerfil() && this.getPerfil()?.nome === 'Administrador';
  }

  isCoordenador() {
    return this.temPerfil() && this.getPerfil()?.nome === 'Coordenador';
  }

  isUsuario() {
    return this.temPerfil() && this.getPerfil()?.nome === 'Usuario';
  }

  /** Segmento de URL da área logada após o slug do candidato: `admin`, `coordenador` ou `home`. */
  areaLogadaSegmento(): string {
    if (this.isAdmin()) return 'admin';
    if (this.isCoordenador()) return 'coordenador';
    return 'home';
  }

  alterarSenha(senhaAtual: string, senhaNova: string, senhaNovaConfirmacao: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.apiURL}/alterar-senha`,
      {
        senha_atual: senhaAtual,
        senha_nova: senhaNova,
        senha_nova_confirmacao: senhaNovaConfirmacao,
      },
      { headers: { Authorization: `Bearer ${this.getAccessToken()}` } },
    );
  }

  /** JWT curto para montar o link público de cadastro com `?t=` (perfil Coordenador + candidato no token). */
  obterChaveDivulgacaoLinkCadastro(): Observable<{ chave_publica: string }> {
    return this.http.get<{ chave_publica: string }>(`${this.apiURL}/link-cadastro-divulgacao-chave`);
  }

  private normalizePapeis(response: { papeis?: Perfil[]; up?: Perfil[] }): Perfil[] {
    return response.papeis ?? response.up ?? [];
  }
}

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const authService = inject(AutenticacaoService);
  const token = authService.getAccessToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const newRequest = req.clone({
    setHeaders: headers,
  });

  return next(newRequest);
}
