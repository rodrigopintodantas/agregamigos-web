import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type CampanhaStatus = 'rascunho' | 'montada' | 'em_andamento' | 'finalizada' | 'cancelada';

export interface CampanhaDivulgacaoItem {
  id: number;
  nome: string;
  status: CampanhaStatus;
  total_destinatarios: number;
  total_enviados: number;
  total_pendentes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CriarCampanhaPayload {
  nome: string;
  pessoa_ids: number[];
  modelo_ids: number[];
}

export interface CriarCampanhaResponse {
  id: number;
  message: string;
  status: CampanhaStatus;
  total_destinatarios: number;
}

export interface CampanhaDestinatarioDetalhe {
  id: number;
  ordem: number;
  status: string;
  tentativas: number;
  enviado_em: string | null;
  erro_ultimo: string | null;
  pessoa: {
    id: number;
    nome: string;
    whatsapp: string | null;
  } | null;
  modelo: {
    id: number;
    titulo: string;
  } | null;
}

export interface CampanhaDivulgacaoDetalhe {
  id: number;
  nome: string;
  status: CampanhaStatus;
  total_destinatarios: number;
  total_enviados: number;
  createdAt: string;
  updatedAt: string;
  destinatarios: CampanhaDestinatarioDetalhe[];
}

@Injectable({ providedIn: 'root' })
export class CampanhaDivulgacaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/campanhas-divulgacao`;

  listar(): Observable<CampanhaDivulgacaoItem[]> {
    return this.http.get<CampanhaDivulgacaoItem[]>(this.base);
  }

  criar(payload: CriarCampanhaPayload): Observable<CriarCampanhaResponse> {
    return this.http.post<CriarCampanhaResponse>(this.base, payload);
  }

  detalhe(id: number): Observable<CampanhaDivulgacaoDetalhe> {
    return this.http.get<CampanhaDivulgacaoDetalhe>(`${this.base}/${id}`);
  }
}
