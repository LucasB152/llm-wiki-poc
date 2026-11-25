import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly year = new Date().getFullYear();
  protected readonly links = [
    { path: '/wiki', label: 'Wiki' },
    { path: '/files', label: 'Files' },
    { path: '/api-keys', label: 'API Keys' },
  ];
}
