import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ModeloMensagemTipo = 'texto' | 'botoes';

export interface ModeloMensagem {
  id: number;
  titulo: string;
  corpo: string;
  tipo_mensagem: ModeloMensagemTipo;
  opcoes_botoes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ModeloMensagemPayload {
  titulo: string;
  corpo: string;
  tipo_mensagem: ModeloMensagemTipo;
  opcoes_botoes?: string[];
}

@Injectable({ providedIn: 'root' })
export class ModeloMensagemService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/modelos-mensagem`;

  listar(): Observable<ModeloMensagem[]> {
    return this.http.get<ModeloMensagem[]>(this.base);
  }

  criar(payload: ModeloMensagemPayload): Observable<ModeloMensagem> {
    return this.http.post<ModeloMensagem>(this.base, payload);
  }

  atualizar(id: number, payload: ModeloMensagemPayload): Observable<ModeloMensagem> {
    return this.http.put<ModeloMensagem>(`${this.base}/${id}`, payload);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
