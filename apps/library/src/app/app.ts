import { Component } from '@angular/core';
import { BooksPage } from './features/books/books-page';

@Component({
  imports: [BooksPage],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
