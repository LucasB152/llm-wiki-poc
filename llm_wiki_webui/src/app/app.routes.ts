import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'wiki', loadComponent: () => import('./features/wiki/wiki').then((m) => m.Wiki) },
  { path: 'files', loadComponent: () => import('./features/files/files').then((m) => m.Files) },
  { path: 'api-keys', loadComponent: () => import('./features/llm/llm').then((m) => m.Llm) },
  { path: '**', redirectTo: '' },
];
