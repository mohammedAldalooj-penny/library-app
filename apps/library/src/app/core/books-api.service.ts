import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  Book,
  CreateBookInput,
  DeleteBookResponse,
  UpdateBookInput,
} from '@library-app/shared-models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BooksApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/books';

  list(query = ''): Observable<Book[]> {
    const params = query ? { q: query } : undefined;
    return this.http.get<Book[]>(this.endpoint, { params });
  }

  create(input: CreateBookInput): Observable<Book> {
    return this.http.post<Book>(this.endpoint, input);
  }

  update(id: string, input: UpdateBookInput): Observable<Book> {
    return this.http.patch<Book>(`${this.endpoint}/${id}`, input);
  }

  remove(id: string): Observable<DeleteBookResponse> {
    return this.http.delete<DeleteBookResponse>(`${this.endpoint}/${id}`);
  }
}
