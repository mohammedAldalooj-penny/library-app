import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  Book,
  CreateBookInput,
  UpdateBookInput,
} from '@library-app/shared-models';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  finalize,
} from 'rxjs';
import { BooksApiService } from '../../core/books-api.service';

@Component({
  selector: 'app-books-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './books-page.html',
  styleUrl: './books-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooksPage implements OnInit {
  private readonly booksApi = inject(BooksApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly countLabel = computed(() => {
    const count = this.books().length;
    return `${count} ${count === 1 ? 'book' : 'books'}`;
  });

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    author: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    isbn: new FormControl('', { nonNullable: true }),
    publishedYear: new FormControl<number | null>(null, [
      Validators.min(0),
      Validators.max(new Date().getFullYear() + 1),
    ]),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  ngOnInit(): void {
    this.loadBooks();
    this.search.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadBooks());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const input: CreateBookInput = {
      title: value.title.trim(),
      author: value.author.trim(),
      ...(value.isbn.trim() && { isbn: value.isbn.trim() }),
      ...(value.description.trim() && {
        description: value.description.trim(),
      }),
      ...(value.publishedYear != null && {
        publishedYear: value.publishedYear,
      }),
    };
    const id = this.editingId();
    const updateInput: UpdateBookInput = {
      ...input,
      isbn: value.isbn.trim() || null,
      description: value.description.trim() || null,
      publishedYear: value.publishedYear,
    };
    const request = id
      ? this.booksApi.update(id, updateInput)
      : this.booksApi.create(input);

    this.saving.set(true);
    this.error.set('');
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        catchError((error: HttpErrorResponse) => {
          this.error.set(this.errorMessage(error));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.resetForm();
        this.loadBooks();
      });
  }

  protected edit(book: Book): void {
    this.editingId.set(book._id);
    this.form.setValue({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? '',
      publishedYear: book.publishedYear ?? null,
      description: book.description ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected remove(book: Book): void {
    if (!window.confirm(`Remove “${book.title}” from your library?`)) {
      return;
    }

    this.deletingId.set(book._id);
    this.error.set('');
    this.booksApi
      .remove(book._id)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        catchError((error: HttpErrorResponse) => {
          this.error.set(this.errorMessage(error));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.editingId() === book._id) {
          this.resetForm();
        }
        this.loadBooks();
      });
  }

  protected clearSearch(): void {
    this.search.setValue('');
  }

  protected trackBook(_: number, book: Book): string {
    return book._id;
  }

  private loadBooks(): void {
    this.loading.set(true);
    this.error.set('');
    this.booksApi
      .list(this.search.value.trim())
      .pipe(
        finalize(() => this.loading.set(false)),
        catchError((error: HttpErrorResponse) => {
          this.error.set(this.errorMessage(error));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((books) => this.books.set(books));
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      author: '',
      isbn: '',
      publishedYear: null,
      description: '',
    });
    this.editingId.set(null);
  }

  private errorMessage(error: HttpErrorResponse): string {
    const message = error.error?.message;
    if (Array.isArray(message)) {
      return message.join('. ');
    }
    return typeof message === 'string'
      ? message
      : 'Something went wrong. Please try again.';
  }
}
