import { Component, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideMenuComponent } from './components/side-menu.component';
import { CanvasComponent } from './components/canvas.component';
import { PropertiesEditorComponent } from './components/properties-editor.component';
import { HeaderBarComponent } from './components/header-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderBarComponent, SideMenuComponent, CanvasComponent, PropertiesEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('BfUiBuilder');
}

// Set a CSS variable with the header height so overlays can position below it.
export class AppLayoutHelpers implements AfterViewInit, OnDestroy {
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.updateHeaderHeight();
    const header = document.querySelector('.header-bar');
    if (header && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateHeaderHeight());
      this.resizeObserver.observe(header as Element);
    }
    window.addEventListener('resize', this.updateHeaderHeight);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.updateHeaderHeight);
  }

  private updateHeaderHeight = (): void => {
    const header = document.querySelector('.header-bar') as HTMLElement | null;
    const height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--app-header-height', `${height}px`);
  };
}
