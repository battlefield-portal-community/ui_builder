import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBuilderService, UIExportArtifacts } from '../services/ui-builder.service';
import { CanvasBackgroundAsset, CanvasBackgroundMode } from '../../models/types';

@Component({
  selector: 'app-header-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-bar.component.html',
  styleUrl: './header-bar.component.scss'
})
export class HeaderBarComponent {
  readonly title = 'UI Builder';
  readonly defaultBackgroundImage: CanvasBackgroundAsset;

  readonly elements = computed(() => this.uiBuilder.elements());
  readonly backgroundMode = computed(() => this.uiBuilder.canvasBackgroundMode());
  readonly backgroundImage = computed(() => this.uiBuilder.canvasBackgroundImage());
  readonly backgroundImages = computed(() =>
    [...this.uiBuilder.canvasBackgroundImages()].sort((a, b) => a.label.localeCompare(b.label))
  );

  readonly exportModalOpen = signal(false);
  readonly exportArtifacts = signal<UIExportArtifacts | null>(null);

  constructor(private readonly uiBuilder: UiBuilderService) {
    this.defaultBackgroundImage = this.uiBuilder.defaultCanvasBackgroundImage;
  }

  setBackgroundMode(mode: CanvasBackgroundMode) {
    this.uiBuilder.setCanvasBackgroundMode(mode);
  }

  setBackgroundImage(imageId: string) {
    this.uiBuilder.setCanvasBackgroundImage(imageId);
  }

  isBackgroundImageSelected(imageId: string): boolean {
    return this.backgroundImage() === imageId;
  }

  onBackgroundImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    Array.from(input.files).forEach(file => this.uiBuilder.addCanvasBackgroundImageFromFile(file));

    input.value = '';
    if (this.backgroundMode() !== 'image') {
      this.setBackgroundMode('image');
    }
  }

  exportArtifactsToJson() {
    if (this.elements().length === 0) {
      return;
    }

    const artifacts = this.uiBuilder.generateExportArtifacts();
    this.exportArtifacts.set(artifacts);
    this.exportModalOpen.set(true);
  }

  closeExportModal() {
    this.exportModalOpen.set(false);
  }

  async copyExportContent(section: 'typescript' | 'strings') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) {
      return;
    }

    const content = section === 'typescript' ? artifacts.typescriptCode : artifacts.stringsJson;

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy export content:', error);
    }
  }

  downloadExportContent(section: 'typescript' | 'strings') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) {
      return;
    }

    const content = section === 'typescript' ? artifacts.typescriptCode : artifacts.stringsJson;
    const filename = section === 'typescript' ? 'ui-export.ts' : 'ui-strings.json';
    const type = section === 'typescript' ? 'text/plain' : 'application/json';

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
