import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  UiBuilderService,
  UIExportArtifacts,
  UIExportSnippet,
} from '../services/ui-builder.service';
import { CanvasBackgroundAsset, CanvasBackgroundMode } from '../../models/types';

type BannerMessage = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-header-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-bar.component.html',
  styleUrl: './header-bar.component.scss'
})
export class HeaderBarComponent implements OnDestroy {
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
  readonly exportMode = signal<'combined' | 'split'>('combined');
  readonly importModalOpen = signal(false);
  readonly importSource = signal('');
  readonly importError = signal<string | null>(null);
  readonly importMode = signal<'replace' | 'append'>('replace');
  readonly bannerMessage = signal<BannerMessage | null>(null);

  private bannerTimeout: number | null = null;

  constructor(private readonly uiBuilder: UiBuilderService) {
    this.defaultBackgroundImage = this.uiBuilder.defaultCanvasBackgroundImage;
  }

  ngOnDestroy() {
    this.clearBannerTimeout();
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
    this.exportMode.set('combined');
    this.exportModalOpen.set(true);
  }

  closeExportModal() {
    this.exportModalOpen.set(false);
    this.exportMode.set('combined');
  }

  setExportMode(mode: 'combined' | 'split') {
    this.exportMode.set(mode);
  }

  async copyExportContent(section: 'typescript' | 'strings') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) {
      return;
    }

    if (section === 'typescript' && this.exportMode() === 'split') {
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

    if (section === 'typescript' && this.exportMode() === 'split') {
      return;
    }

    const content = section === 'typescript' ? artifacts.typescriptCode : artifacts.stringsJson;
    const filename = section === 'typescript' ? 'ui-export.ts' : 'ui-strings.json';
    const type = section === 'typescript' ? 'text/plain' : 'application/json';

    this.triggerDownload(content, filename, type);
  }

  async copySnippet(snippet: UIExportSnippet) {
    try {
      await navigator.clipboard.writeText(snippet.code);
    } catch (error) {
      console.error('Failed to copy snippet:', error);
    }
  }

  downloadSnippet(snippet: UIExportSnippet) {
    const filename = `${snippet.variableName}.ts`;
    this.triggerDownload(snippet.code, filename, 'text/plain');
  }

  openImportModal() {
    this.importSource.set('');
    this.importError.set(null);
    this.importMode.set('replace');
    this.importModalOpen.set(true);
  }

  closeImportModal() {
    this.importModalOpen.set(false);
    this.importSource.set('');
    this.importError.set(null);
    this.importMode.set('replace');
  }

  onImportSourceChange(event: Event) {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.importSource.set(value);
    if (this.importError()) {
      this.importError.set(null);
    }
  }

  setImportMode(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
      return;
    }

    this.importMode.set(target.checked ? 'append' : 'replace');
  }

  submitImport() {
    const source = this.importSource().trim();
    if (!source) {
      this.importError.set('Paste a TypeScript snippet before importing.');
      return;
    }

    const mode = this.importMode();

    try {
      const result = this.uiBuilder.importFromTypescript(source, { mode });
      if (!result.success) {
        this.importError.set(result.error ?? 'Import failed.');
        this.showBannerMessage(result.error ?? 'Import failed.', 'error', false);
        return;
      }

      this.closeImportModal();
      const count = result.importedCount ?? 0;
      const suffix = count === 1 ? '' : 's';
      const verb = mode === 'append' ? 'Appended' : 'Imported';
      const details = count === 0
        ? mode === 'append'
          ? 'No new elements detected.'
          : 'UI cleared. No elements detected in snippet.'
        : `${verb} ${count} root element${suffix} from script.`;
      this.showBannerMessage(details, 'success');
    } catch (error) {
      console.error('Failed to import UI:', error);
      this.importError.set('Unexpected error while importing. Please verify the snippet and try again.');
      this.showBannerMessage('Import failed due to an unexpected error.', 'error', false);
    }
  }

  dismissBannerMessage() {
    this.bannerMessage.set(null);
    this.clearBannerTimeout();
  }

  private showBannerMessage(text: string, type: 'success' | 'error', autoDismiss = true) {
    this.bannerMessage.set({ text, type });
    this.clearBannerTimeout();

    if (!autoDismiss) {
      return;
    }

    if (typeof window !== 'undefined') {
      this.bannerTimeout = window.setTimeout(() => {
        this.bannerMessage.set(null);
        this.bannerTimeout = null;
      }, 4000);
    }
  }

  private clearBannerTimeout() {
    if (this.bannerTimeout !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
  }

  private triggerDownload(content: string, filename: string, type: string) {
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
