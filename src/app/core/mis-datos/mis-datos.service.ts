import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { DataCollectionRow, UploadCollectionPayload } from './mis-datos.models';

const BASE_URL = environment.apiBaseUrl + '/loaddata';

@Injectable({ providedIn: 'root' })
export class MisDatosService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  upload(payload: UploadCollectionPayload): Observable<void> {
    const body = { ...payload, sessionid: this.auth.sessionIdOrNull };
    return this.http.post<{ status: number }>(`${BASE_URL}/loadOccDataGroup`, body).pipe(map(() => void 0));
  }

  list(): Observable<DataCollectionRow[]> {
    return this.http
      .post<{ status: number; data: DataCollectionRow[] }>(`${BASE_URL}/getProfileDataList`, {
        sessionid: this.auth.sessionIdOrNull,
      })
      .pipe(map((res) => res.data ?? []));
  }

  remove(id_data: number): Observable<void> {
    return this.http
      .post<{ status: number }>(`${BASE_URL}/deleteLoadedData`, {
        sessionid: this.auth.sessionIdOrNull,
        id_data,
      })
      .pipe(map(() => void 0));
  }
}
