import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MultiplicadorCoordenadorItem {
  id: number;
  nome: string;
  login: string | null;
  email: string | null;
  telefone: string | null;
  total_cadastros: number;
}

export interface MultiplicadorComparativoItem {
  coordenador_id: number;
  nome: string;
  total: number;
}

export interface MultiplicadorComparativoEventoItem {
  evento_id: number;
  nome: string;
  total: number;
}

export interface MultiplicadorSerieMensal {
  coordenador_id: number;
  nome: string;
  totais: number[];
}

export interface MultiplicadoresPainelResponse {
  totais: {
    cadastros: number;
    coordenadores: number;
    com_cadastro: number;
  };
  coordenadores: MultiplicadorCoordenadorItem[];
  comparativo: MultiplicadorComparativoItem[];
  comparativo_eventos: MultiplicadorComparativoEventoItem[];
  evolucao_mensal: {
    meses: string[];
    series: MultiplicadorSerieMensal[];
    max_y: number;
  };
}

@Injectable({ providedIn: 'root' })
export class MultiplicadoresService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/multiplicadores`;

  painel(): Observable<MultiplicadoresPainelResponse> {
    return this.http.get<MultiplicadoresPainelResponse>(`${this.base}/painel`);
  }
}
