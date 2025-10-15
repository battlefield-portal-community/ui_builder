import { Injectable, signal } from '@angular/core';
import { UIElement, UIElementTypes, DEFAULT_UI_PARAMS, UIAnchor } from '../../models/types';

@Injectable({
  providedIn: 'root'
})
export class UiBuilderService {
  private _elements = signal<UIElement[]>([]);
  private _selectedElementId = signal<string | null>(null);
  private _nextId = 1;

  // Public readonly signals
  readonly elements = this._elements.asReadonly();
  readonly selectedElementId = this._selectedElementId.asReadonly();

  constructor() {}

  // Generate unique ID
  private generateId(): string {
    return `element_${this._nextId++}`;
  }

  // Create a new UI element with default values
  createUIElement(type: UIElementTypes, name?: string): UIElement {
    const id = this.generateId();
    return {
      id,
      name: name || `${type}_${id}`,
      type,
      ...DEFAULT_UI_PARAMS,
      children: [],
    } as UIElement;
  }

  // Add element to root or selected element
  addElement(type: UIElementTypes, name?: string): void {
    const newElement = this.createUIElement(type, name);
    const selectedId = this._selectedElementId();
    
    if (selectedId) {
      // Add to selected element
      this.addElementToParent(newElement, selectedId);
    } else {
      // Add to root
      this._elements.update(elements => [...elements, newElement]);
    }
    
    // Select the newly added element
    this._selectedElementId.set(newElement.id);
  }

  // Add element to specific parent
  private addElementToParent(element: UIElement, parentId: string): void {
    this._elements.update(elements => {
      return this.updateElementRecursive(elements, parentId, (parent) => ({
        ...parent,
        children: [...(parent.children || []), element]
      }));
    });
  }

  // Recursively update an element
  private updateElementRecursive(
    elements: UIElement[],
    targetId: string,
    updateFn: (element: UIElement) => UIElement
  ): UIElement[] {
    return elements.map(element => {
      if (element.id === targetId) {
        return updateFn(element);
      }
      if (element.children?.length) {
        return {
          ...element,
          children: this.updateElementRecursive(element.children, targetId, updateFn)
        };
      }
      return element;
    });
  }

  // Update element properties
  updateElement(elementId: string, updates: Partial<UIElement>): void {
    this._elements.update(elements => {
      return this.updateElementRecursive(elements, elementId, (element) => ({
        ...element,
        ...updates
      }));
    });
  }

  // Select element
  selectElement(elementId: string | null): void {
    this._selectedElementId.set(elementId);
  }

  // Get selected element
  getSelectedElement(): UIElement | null {
    const selectedId = this._selectedElementId();
    if (!selectedId) return null;
    return this.findElementById(selectedId);
  }

  // Find element by ID
  findElementById(id: string): UIElement | null {
    const search = (elements: UIElement[]): UIElement | null => {
      for (const element of elements) {
        if (element.id === id) return element;
        if (element.children?.length) {
          const found = search(element.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this._elements());
  }

  // Remove element
  removeElement(elementId: string): void {
    this._elements.update(elements => {
      return this.removeElementRecursive(elements, elementId);
    });
    
    // Clear selection if removed element was selected
    if (this._selectedElementId() === elementId) {
      this._selectedElementId.set(null);
    }
  }

  moveElement(elementId: string, direction: 'up' | 'down'): void {
    const offset = direction === 'up' ? -1 : 1;
    this._elements.update(elements => {
      const { elements: updated, moved } = this.moveElementRecursive(elements, elementId, offset);
      return moved ? updated : elements;
    });
  }

  getElementLocation(elementId: string): { parentId: string | null; index: number; siblingCount: number } | null {
    const search = (elements: UIElement[], parentId: string | null): { parentId: string | null; index: number; siblingCount: number } | null => {
      const index = elements.findIndex(element => element.id === elementId);
      if (index !== -1) {
        return {
          parentId,
          index,
          siblingCount: elements.length,
        };
      }

      for (const element of elements) {
        if (element.children?.length) {
          const found = search(element.children, element.id);
          if (found) {
            return found;
          }
        }
      }

      return null;
    };

    return search(this._elements(), null);
  }

  // Recursively remove element
  private removeElementRecursive(elements: UIElement[], targetId: string): UIElement[] {
    return elements
      .filter(element => element.id !== targetId)
      .map(element => ({
        ...element,
        children: element.children ? this.removeElementRecursive(element.children, targetId) : []
      }));
  }

  private moveElementRecursive(elements: UIElement[], elementId: string, offset: number): { elements: UIElement[]; moved: boolean } {
    const index = elements.findIndex(element => element.id === elementId);

    if (index !== -1) {
      const newIndex = index + offset;
      if (newIndex < 0 || newIndex >= elements.length) {
        return { elements, moved: false };
      }

      const reordered = [...elements];
      const [element] = reordered.splice(index, 1);
      reordered.splice(newIndex, 0, element);

      return { elements: reordered, moved: true };
    }

    let moved = false;
    const updated = elements.map(element => {
      if (!element.children?.length || moved) {
        return element;
      }

      const result = this.moveElementRecursive(element.children, elementId, offset);
      if (result.moved) {
        moved = true;
        return {
          ...element,
          children: result.elements
        };
      }

      return element;
    });

    return { elements: moved ? updated : elements, moved };
  }

  // Export to JSON
  exportToJson(): string {
    const convertToUIParams = (element: UIElement): any => {
      const { id, ...params } = element;
      return {
        ...params,
        children: element.children?.map(child => convertToUIParams(child)) || []
      };
    };

    const exportData = this._elements().map(element => convertToUIParams(element));
    return JSON.stringify(exportData, null, 2);
  }

  // Clear all elements
  clear(): void {
    this._elements.set([]);
    this._selectedElementId.set(null);
    this._nextId = 1;
  }
}