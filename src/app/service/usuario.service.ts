import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PapelItem {
  id: number;
  nome: string;
  dashboard?: string | null;
}

export interface CriarUsuarioPayload {
  nome: string;
  login: string;
  senha: string;
  email?: string | null;
  papel_id: number;
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
  };
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/usuarios`;

  listarPapeis(): Observable<PapelItem[]> {
    return this.http.get<PapelItem[]>(`${this.apiURL}/papeis`);
  }

  criar(payload: CriarUsuarioPayload): Observable<CriarUsuarioResponse> {
    return this.http.post<CriarUsuarioResponse>(this.apiURL, payload);
  }
}
