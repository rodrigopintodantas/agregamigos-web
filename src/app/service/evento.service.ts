import { HttpClient } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';



export type EventoStatus = 'ativo' | 'encerrado';



export interface EventoCoordenadorResumo {

  id: number;

  nome: string;

}



export interface EventoItem {

  id: number;

  nome: string;

  descricao: string | null;

  data_evento: string | null;

  locais: string[];

  local: string | null;

  status: EventoStatus | string;

  total_inscritos: number;

  token_cadastro: string;

  coordenadores: EventoCoordenadorResumo[];

  createdAt: string;

  updatedAt: string;

}



export interface EventoInscritoItem {

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



export interface EventoDetalhe extends EventoItem {

  candidato_slug: string;

  link_cadastro_path: string | null;

  inscritos: EventoInscritoItem[];

}



export interface CriarEventoPayload {

  nome: string;

  descricao?: string | null;

  data_evento?: string | null;

  locais?: string[];

  id_coordenadores?: number[];

}



@Injectable({ providedIn: 'root' })

export class EventoService {

  private http = inject(HttpClient);

  private base = `${environment.apiUrl}/eventos`;



  listar(): Observable<EventoItem[]> {

    return this.http.get<EventoItem[]>(this.base);

  }



  detalhe(id: number): Observable<EventoDetalhe> {

    return this.http.get<EventoDetalhe>(`${this.base}/${id}`);

  }



  criar(payload: CriarEventoPayload): Observable<{ message: string; evento: EventoItem }> {

    return this.http.post<{ message: string; evento: EventoItem }>(this.base, payload);

  }



  listarCoordenadores(): Observable<{ coordenadores: EventoCoordenadorResumo[] }> {

    return this.http.get<{ coordenadores: EventoCoordenadorResumo[] }>(`${this.base}/coordenadores`);

  }



  alterarStatus(id: number, status: EventoStatus): Observable<{ message: string; status: string }> {

    return this.http.patch<{ message: string; status: string }>(`${this.base}/${id}/status`, { status });

  }



  excluir(id: number): Observable<{ message: string }> {

    return this.http.delete<{ message: string }>(`${this.base}/${id}`);

  }

}

