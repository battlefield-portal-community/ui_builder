import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBuilderService, UIExportArtifacts } from '../services/ui-builder.service';
import { UIElementTypes, UIElement, CanvasBackgroundMode, CanvasBackgroundAsset } from '../../models/types';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent {
  elementTypes: UIElementTypes[] = ['Container', 'Text', 'Image', 'Button'];

  elements = computed(() => this.uiBuilder.elements());
  selectedElementId = computed(() => this.uiBuilder.selectedElementId());
  selectedElement = computed(() => this.uiBuilder.getSelectedElement());
  backgroundMode = computed(() => this.uiBuilder.canvasBackgroundMode());
  backgroundImage = computed(() => this.uiBuilder.canvasBackgroundImage());
  backgroundImages = computed(() =>
    [...this.uiBuilder.canvasBackgroundImages()].sort((a, b) => a.label.localeCompare(b.label))
  );
  backgroundImageUrl = computed(() => this.uiBuilder.canvasBackgroundImageUrl());
  snapToElements = computed(() => this.uiBuilder.snapToElements());
  exportModalOpen = signal(false);
  exportArtifacts = signal<UIExportArtifacts | null>(null);
  readonly defaultBackgroundImage: CanvasBackgroundAsset;

  constructor(private uiBuilder: UiBuilderService) {
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

    Array.from(input.files).forEach(file => {
      this.uiBuilder.addCanvasBackgroundImageFromFile(file);
    });

    input.value = '';
    const currentMode = this.backgroundMode();
    if (currentMode !== 'image') {
      this.setBackgroundMode('image');
    }
  }

  addElement(type: UIElementTypes) {
    this.uiBuilder.addElement(type);
  }

  selectElement(elementId: string) {
    this.uiBuilder.selectElement(elementId);
  }

  deleteElement(event: MouseEvent, elementId: string) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this element and all its children?')) {
      this.uiBuilder.removeElement(elementId);
    }
  }

  duplicateSelectedElement() {
    const selectedId = this.selectedElementId();
    if (!selectedId) {
      return;
    }

    this.uiBuilder.duplicateElement(selectedId);
  }

  moveElement(event: MouseEvent, elementId: string, direction: 'up' | 'down') {
    event.stopPropagation();
    this.uiBuilder.moveElement(elementId, direction);
  }

  canMove(element: UIElement, direction: 'up' | 'down'): boolean {
    const location = this.uiBuilder.getElementLocation(element.id);
    if (!location) return false;

    if (direction === 'up') {
      return location.index > 0;
    }

    return location.index < location.siblingCount - 1;
  }

  exportJson() {
    const artifacts = this.uiBuilder.generateExportArtifacts();
    this.exportArtifacts.set(artifacts);
    this.exportModalOpen.set(true);
  }

  closeExportModal() {
    this.exportModalOpen.set(false);
  }

  async copyExportContent(section: 'typescript' | 'strings') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) return;

    const content = section === 'typescript' ? artifacts.typescriptCode : artifacts.stringsJson;

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy export content:', error);
    }
  }

  downloadExportContent(section: 'typescript' | 'strings') {
    const artifacts = this.exportArtifacts();
    if (!artifacts) return;

    const content = section === 'typescript' ? artifacts.typescriptCode : artifacts.stringsJson;
    const filename = section === 'typescript' ? 'ui-export.ts' : 'ui-strings.json';
    const type = section === 'typescript' ? 'text/plain' : 'application/json';

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearAll() {
    if (confirm('Are you sure you want to clear all elements?')) {
      this.uiBuilder.clear();
    }
  }

  setSnapToElements(enabled: boolean) {
    this.uiBuilder.setSnapToElements(enabled);
  }

  getElementIcon(type: UIElementTypes): string {
    switch (type) {
      case 'Container': return '📦';
      case 'Text': return '📝';
      case 'Image': return '🖼️';
      case 'Button': return '🔘';
      default: return '❓';
    }
  }

  getFlattenedElements(): Array<{ element: UIElement, level: number }> {
    const flattened: Array<{ element: UIElement, level: number }> = [];
    
    const flatten = (elements: UIElement[], level: number) => {
      for (const element of elements) {
        flattened.push({ element, level });
        if (element.children && element.children.length > 0) {
          flatten(element.children, level + 1);
        }
      }
    };
    
    flatten(this.elements(), 0);
    return flattened;
  }

  getIndentIndicator(level: number): string {
    if (level === 0) return '';
    return '└' + '─'.repeat(level - 1);
  }
}