import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideMenuComponent } from './components/side-menu.component';
import { CanvasComponent } from './components/canvas.component';
import { PropertiesEditorComponent } from './components/properties-editor.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SideMenuComponent, CanvasComponent, PropertiesEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('BfUiBuilder');
}
