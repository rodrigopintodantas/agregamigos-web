import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CandidatoResumo } from '../types/candidato.model';

export type CriarCandidatoPayload = {
  nome: string;
  slug: string;
};

@Injectable({ providedIn: 'root' })
export class CandidatoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/candidatos`;

  criar(payload: CriarCandidatoPayload): Observable<{ candidato: CandidatoResumo; message: string }> {
    return this.http.post<{ candidato: CandidatoResumo; message: string }>(this.base, payload);
  }
}
