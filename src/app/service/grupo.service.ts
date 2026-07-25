import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type GrupoStatus = 'ativo' | 'encerrado';

export interface GrupoCoordenadorResumo {
  id: number;
  nome: string;
}

export interface GrupoItem {
  id: number;
  nome: string;
  descricao: string | null;
  status: GrupoStatus | string;
  total_inscritos: number;
  token_cadastro: string;
  coordenadores: GrupoCoordenadorResumo[];
  createdAt: string;
  updatedAt: string;
}

export interface GrupoInscritoItem {
  id: number;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  bairro: string | null;
  cidade: string | null;
  coordenador_id: number | null;
  coordenador_nome: string | null;
  inscrito_em: string;
  pessoa_cadastrada_em: string;
}

export interface GrupoDetalhe extends GrupoItem {
  candidato_slug: string;
  link_cadastro_path: string | null;
  inscritos: GrupoInscritoItem[];
}

export interface CriarGrupoPayload {
  nome: string;
  descricao?: string | null;
  id_coordenadores?: number[];
}

@Injectable({ providedIn: 'root' })
export class GrupoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/grupos`;

  listar(): Observable<GrupoItem[]> {
    return this.http.get<GrupoItem[]>(this.base);
  }

  detalhe(id: number): Observable<GrupoDetalhe> {
    return this.http.get<GrupoDetalhe>(`${this.base}/${id}`);
  }

  criar(payload: CriarGrupoPayload): Observable<{ message: string; grupo: GrupoItem }> {
    return this.http.post<{ message: string; grupo: GrupoItem }>(this.base, payload);
  }

  listarCoordenadores(): Observable<{ coordenadores: GrupoCoordenadorResumo[] }> {
    return this.http.get<{ coordenadores: GrupoCoordenadorResumo[] }>(`${this.base}/coordenadores`);
  }

  alterarStatus(id: number, status: GrupoStatus): Observable<{ message: string; status: string }> {
    return this.http.patch<{ message: string; status: string }>(`${this.base}/${id}/status`, { status });
  }

  excluir(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
