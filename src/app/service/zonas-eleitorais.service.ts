import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ZonaEleitoral {
  id: number;
  nr_zona: number;
  nm_zona: string;
}

@Injectable({ providedIn: 'root' })
export class ZonasEleitoraisService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/zonas-eleitorais`;

  listar(): Observable<ZonaEleitoral[]> {
    return this.http.get<ZonaEleitoral[]>(this.apiURL);
  }
}
