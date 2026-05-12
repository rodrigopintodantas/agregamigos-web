import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OuvidoriaItem {
  id: number;
  dt_manifestacao?: string | null;
  fl_indicador?: boolean | null;
  ds_situacao?: string | null;
  ds_tipo?: string | null;
  ds_assunto?: string | null;
  ds_ra?: string | null;
  nm_orgao?: string | null;
  nm_secretaria?: string | null;
  ds_canal?: string | null;
}

export interface ImportarCsvOuvidoriaPayload {
  registros: Record<string, string>[];
}

export interface ImportarCsvOuvidoriaResponse {
  message: string;
  total: number;
  inseridos?: number;
  ignorados?: number;
}

@Injectable({ providedIn: 'root' })
export class OuvidoriaService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/ouvidoria`;

  listar(): Observable<OuvidoriaItem[]> {
    return this.http.get<OuvidoriaItem[]>(this.apiURL);
  }

  importarCsv(payload: ImportarCsvOuvidoriaPayload): Observable<ImportarCsvOuvidoriaResponse> {
    return this.http.post<ImportarCsvOuvidoriaResponse>(`${this.apiURL}/importar-csv`, payload);
  }
}
