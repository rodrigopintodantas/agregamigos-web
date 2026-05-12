import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VotacaoItem {
  id: number;
  sg_uf?: string | null;
  nr_zona?: number | null;
  cd_cargo?: number | null;
  ds_cargo?: string | null;
  nr_candidato?: number | null;
  nm_candidato?: string | null;
  nm_urna_candidato?: string | null;
  sg_partido?: string | null;
  ds_composicao_coligacao?: string | null;
  nr_turno?: number | null;
  ds_sit_totalizacao?: string | null;
  nm_tipo_destinacao_votos?: string | null;
  dt_ult_totalizacao?: string | null;
  pc_votos_validos?: string | null;
  qt_votos_nom_validos?: string | null;
  qt_votos_concorrentes?: string | null;
}

export interface ImportarCsvVotacaoPayload {
  registros: Record<string, string>[];
}

export interface ImportarCsvVotacaoResponse {
  message: string;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class VotacaoService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/votacao`;

  listar(): Observable<VotacaoItem[]> {
    return this.http.get<VotacaoItem[]>(this.apiURL);
  }

  importarCsv(payload: ImportarCsvVotacaoPayload): Observable<ImportarCsvVotacaoResponse> {
    return this.http.post<ImportarCsvVotacaoResponse>(`${this.apiURL}/importar-csv`, payload);
  }
}
