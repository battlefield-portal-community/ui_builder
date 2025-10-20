import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBuilderService } from '../services/ui-builder.service';
import { UIElementTypes, UIElement } from '../../models/types';

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
  snapToElements = computed(() => this.uiBuilder.snapToElements());

  constructor(private uiBuilder: UiBuilderService) {
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