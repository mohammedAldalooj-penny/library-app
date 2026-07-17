import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/books/books-page').then((module) => module.BooksPage),
    title: 'Leafmark Library',
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./features/chat/chat-page').then((module) => module.ChatPage),
    title: 'Leafmark AI',
  },
  { path: '**', redirectTo: '' },
];
