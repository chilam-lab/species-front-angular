import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AnalysisHistoryRow } from './analysis-history.models';

const BASE_URL = environment.apiBaseUrl + '/mdf';

@Injectable({ providedIn: 'root' })
export class AnalysisHistoryService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  list(): Observable<AnalysisHistoryRow[]> {
    return this.http
      .post<{ status: number; data: AnalysisHistoryRow[] }>(`${BASE_URL}/getAnalysisHistory`, {
        sessionid: this.auth.sessionIdOrNull,
      })
      .pipe(map((res) => res.data ?? []));
  }

  remove(id: number): Observable<void> {
    return this.http
      .post<{ status: number }>(`${BASE_URL}/deleteAnalysisHistory`, {
        sessionid: this.auth.sessionIdOrNull,
        id,
      })
      .pipe(map(() => void 0));
  }
}
