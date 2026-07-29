import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PapelItem {
  id: number;
  nome: string;
  dashboard?: string | null;
}

export interface BairroComPessoasItem {
  bairro: string;
  quantidade: number;
}

export interface CriarUsuarioPayload {
  nome: string;
  login: string;
  senha: string;
  email?: string | null;
  papel_id: number;
}

export interface UsuarioGrupoResumo {
  id: number;
  nome: string;
  status?: string;
}

export interface UsuarioListagemItem {
  id: number;
  nome: string;
  login: string;
  papel: {
    id: number;
    nome: string;
  };
  bairros?: string[];
  grupos?: UsuarioGrupoResumo[];
}

export interface CriarUsuarioResponse {
  message: string;
  usuario: {
    id: number;
    nome: string;
    login: string;
    email?: string | null;
    papel: {
      id: number;
      nome: string;
    };
    bairros?: string[];
  };
}

export interface SalvarBairrosUsuarioResponse {
  message: string;
  bairros: string[];
}

export interface SalvarGruposUsuarioResponse {
  message: string;
  grupos: UsuarioGrupoResumo[];
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/usuarios`;

  listar(): Observable<UsuarioListagemItem[]> {
    return this.http.get<UsuarioListagemItem[]>(this.apiURL);
  }

  listarBairrosComPessoas(): Observable<BairroComPessoasItem[]> {
    return this.http.get<BairroComPessoasItem[]>(`${this.apiURL}/bairros-com-pessoas`);
  }

  listarGruposDisponiveis(): Observable<UsuarioGrupoResumo[]> {
    return this.http.get<UsuarioGrupoResumo[]>(`${this.apiURL}/grupos-disponiveis`);
  }

  listarPapeis(): Observable<PapelItem[]> {
    return this.http.get<PapelItem[]>(`${this.apiURL}/papeis`);
  }

  salvarBairrosUsuario(usuarioId: number, bairros: string[]): Observable<SalvarBairrosUsuarioResponse> {
    return this.http.patch<SalvarBairrosUsuarioResponse>(`${this.apiURL}/${usuarioId}/bairros`, { bairros });
  }

  salvarGruposUsuario(usuarioId: number, grupoIds: number[]): Observable<SalvarGruposUsuarioResponse> {
    return this.http.patch<SalvarGruposUsuarioResponse>(`${this.apiURL}/${usuarioId}/grupos`, {
      grupo_ids: grupoIds,
    });
  }

  criar(payload: CriarUsuarioPayload): Observable<CriarUsuarioResponse> {
    return this.http.post<CriarUsuarioResponse>(this.apiURL, payload);
  }

  reiniciarSenha(usuarioId: number): Observable<{ message: string; usuario: { id: number; nome: string; login: string } }> {
    return this.http.post<{ message: string; usuario: { id: number; nome: string; login: string } }>(
      `${this.apiURL}/${usuarioId}/reiniciar-senha`,
      {},
    );
  }
}
