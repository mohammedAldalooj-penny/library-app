import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { BooksApiService } from './core/books-api.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: BooksApiService,
          useValue: { list: () => of([]) },
        },
      ],
    }).compileComponents();
  });

  it('should render the library heading', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Keep every story',
    );
  });
});
