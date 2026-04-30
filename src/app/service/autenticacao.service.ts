import { HttpClient, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Perfil } from '../types/perfil.model';
import { Usuario } from '../types/usuario.model';

const STORAGE_TOKEN = 'accessToken';

type AuthResponse = {
  token: string;
  usuario: Usuario;
  papeis?: Perfil[];
  up?: Perfil[];
};

@Injectable({
  providedIn: 'root'
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
  }

  /** Login com senha: grava JWT e dados do usuário. */
  autenticar(login: string, senha: string): Observable<{ token: string; usuario: Usuario; papeis: Perfil[] }> {
    const obs = new Subject<{ token: string; usuario: Usuario; papeis: Perfil[] }>();
    const url = `${this.apiURL}/login`;
    this.http.post<AuthResponse>(url, { login: login.trim(), senha }).subscribe({
      next: (retorno) => {
        const papeis = this.normalizePapeis(retorno);
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
        obs.next({ token: retorno.token, usuario: retorno.usuario, papeis });
        obs.complete();
      },
      error: (err) => obs.error(err)
    });
    return obs.asObservable();
  }

  logout() {
    this.authenticated = false;
    this.userLogin = null;
    this.accessToken = null;
    this.limparAutenticacao();
  }

  carregarPerfil(): Observable<unknown> {
    const obs = new Subject<unknown>();

    if (!this.getAccessToken()) {
      obs.error('Usuário não autenticado');
      return obs.asObservable();
    }

    this.http
      .get<{ usuario: Usuario; papeis?: Perfil[]; up?: Perfil[] }>(this.apiURL, {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`
        }
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

          obs.next(retorno);
          obs.complete();
        },
        error: (error) => obs.error(error)
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

  isUsuario() {
    return this.temPerfil() && this.getPerfil()?.nome === 'Usuario';
  }

  alterarSenha(senhaAtual: string, senhaNova: string, senhaNovaConfirmacao: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiURL}/alterar-senha`, {
      senha_atual: senhaAtual,
      senha_nova: senhaNova,
      senha_nova_confirmacao: senhaNovaConfirmacao
    });
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
    setHeaders: headers
  });

  return next(newRequest);
}
