import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EnderecoPayload {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ibge?: string | null;
}

export interface PessoaPayload {
  nome: string;
  data_nascimento?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  endereco?: EnderecoPayload;
}

export interface PessoaItem {
  id: number;
  nome: string;
  data_nascimento?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  endereco?: EnderecoPayload | null;
}

@Injectable({ providedIn: 'root' })
export class PessoaService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/pessoas`;

  listar(): Observable<PessoaItem[]> {
    return this.http.get<PessoaItem[]>(this.apiURL);
  }

  criar(payload: PessoaPayload): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(this.apiURL, payload);
  }

  criarPorLink(payload: PessoaPayload): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(`${this.apiURL}/link-cadastro`, payload);
  }

  atualizar(id: number, payload: PessoaPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiURL}/${id}`, payload);
  }

  excluir(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiURL}/${id}`);
  }
}
