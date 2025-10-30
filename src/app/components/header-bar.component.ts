import { Component, computed, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBuilderService, UIExportArtifacts } from '../services/ui-builder.service';
import { CanvasBackgroundAsset, CanvasBackgroundMode } from '../../models/types';

type BannerMessage = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-header-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-bar.component.html',
  styleUrl: './header-bar.component.scss'
})
export class HeaderBarComponent implements AfterViewInit {
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
  readonly settingsModalOpen = signal(false);
  readonly snapToElements = computed(() => this.uiBuilder.snapToElements());
  readonly showContainerLabels = computed(() => this.uiBuilder.showContainerLabels());
  readonly importModalOpen = signal(false);
  readonly importSource = signal('');
  readonly importError = signal<string | null>(null);
  readonly importMode = signal<'replace' | 'append'>('replace');
  readonly bannerMessage = signal<BannerMessage | null>(null);

  private bannerTimeout: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly uiBuilder: UiBuilderService) {
    this.defaultBackgroundImage = this.uiBuilder.defaultCanvasBackgroundImage;
  }

  ngAfterViewInit(): void {
    this.updateHeaderHeight();
    const header = document.querySelector('.header-bar');
    if (header && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateHeaderHeight());
      this.resizeObserver.observe(header as Element);
    }
    window.addEventListener('resize', this.updateHeaderHeight);
  }

  openSettingsModal() {
    this.settingsModalOpen.set(true);
  }

  closeSettingsModal() {
    this.settingsModalOpen.set(false);
  }

  private updateHeaderHeight = (): void => {
    const header = document.querySelector('.header-bar') as HTMLElement | null;
    const height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--app-header-height', `${height}px`);
  };

  setBackgroundMode(mode: CanvasBackgroundMode) {
    this.uiBuilder.setCanvasBackgroundMode(mode);
  }

  setBackgroundImage(imageId: string) {
    this.uiBuilder.setCanvasBackgroundImage(imageId);
  }

  setSnapToElements(enabled: boolean) {
    this.uiBuilder.setSnapToElements(enabled);
  }

  setShowContainerLabels(enabled: boolean) {
    this.uiBuilder.setShowContainerLabels(enabled);
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

  async exportArtifactsToJson() {
    if (this.elements().length === 0) {
      return;
    }

    const artifacts = await this.uiBuilder.generateExportArtifacts();
    this.exportArtifacts.set(artifacts);
    this.exportModalOpen.set(true);
  }

  closeExportModal() {
    this.exportModalOpen.set(false);
  }

  async copyExportContent(section: 'typescript' | 'strings' | 'advanced') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) {
      return;
    }

    const content = this.getExportContent(section, artifacts);
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy export content:', error);
    }
  }

  downloadExportContent(section: 'typescript' | 'strings' | 'advanced') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) {
      return;
    }

    const content = this.getExportContent(section, artifacts);
    if (!content) {
      return;
    }

    const filename = this.getExportFilename(section);
    const type = section === 'strings' ? 'application/json' : 'text/plain';

    this.triggerDownload(content, filename, type);
  }

  private getExportContent(section: 'typescript' | 'strings' | 'advanced', artifacts: UIExportArtifacts): string {
    switch (section) {
      case 'typescript':
        return artifacts.typescriptCode;
      case 'strings':
        return artifacts.stringsJson;
      case 'advanced':
        return artifacts.advancedTypescriptCode;
      default:
        return '';
    }
  }

  private getExportFilename(section: 'typescript' | 'strings' | 'advanced'): string {
    switch (section) {
      case 'typescript':
        return 'ui-export.ts';
      case 'strings':
        return 'ui-strings.json';
      case 'advanced':
        return 'ui-advanced-widgets.ts';
      default:
        return 'ui-export.txt';
    }
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
