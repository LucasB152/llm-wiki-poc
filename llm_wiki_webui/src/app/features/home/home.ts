import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  host: { class: 'flex flex-1 flex-col justify-center' },
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  protected readonly sections = [
    { path: '/wiki', title: 'Wiki', text: 'Chat with your wiki, choosing the model for each conversation.' },
    { path: '/files', title: 'Files', text: 'Browse your sources, the pages the AI wrote and its log.' },
    { path: '/api-keys', title: 'API Keys', text: 'Add and manage your Gemini, Claude and ChatGPT keys.' },
  ];
}
