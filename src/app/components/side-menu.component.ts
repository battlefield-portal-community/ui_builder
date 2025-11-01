import { Component, HostBinding, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiBuilderService } from '../services/ui-builder.service';
import { UIElementTypes, UIElement } from '../../models/types';

type DropMode = 'before' | 'after' | 'child' | 'root-start' | 'root-end';

interface DropContext {
  targetId: string | null;
  parentId: string | null;
  index: number | null;
  mode: DropMode;
}

interface FlattenedElement {
  element: UIElement;
  level: number;
  parentId: string | null;
  index: number;
  siblingCount: number;
}

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent {
  @HostBinding('class.collapsed')
  get collapsedClass(): boolean {
    return this.isCollapsed();
  }

  @HostBinding('class.dragging')
  get draggingClass(): boolean {
    return this.draggedElementId() !== null;
  }

  elementTypes: UIElementTypes[] = ['Container', 'Text', 'Image', 'Button'];

  elements = computed(() => this.uiBuilder.elements());
  selectedElementId = computed(() => this.uiBuilder.selectedElementId());
  selectedElementIds = computed(() => this.uiBuilder.selectedElementIds());
  selectedElementIdSet = computed(() => new Set(this.selectedElementIds()));
  selectedElement = computed(() => this.uiBuilder.getSelectedElement());
  advancedPresets = computed(() => this.uiBuilder.advancedPresets());
  hasAdvancedPresets = computed(() => this.advancedPresets().length > 0);
  showAdvancedPresets = signal(false);
  isCollapsed = computed(() => this.uiBuilder.sideMenuCollapsed());
  collapseToggleLabel = computed(() => this.isCollapsed() ? 'Expand library panel' : 'Collapse library panel');
  headerTitle = computed(() => this.isCollapsed() ? 'UI' : 'UI Builder');
  flattenedElements = computed<FlattenedElement[]>(() => {
    const result: FlattenedElement[] = [];

    const traverse = (nodes: UIElement[] | undefined | null, level: number, parentId: string | null) => {
      if (!nodes?.length) {
        return;
      }

      nodes.forEach((node, index) => {
        result.push({
          element: node,
          level,
          parentId,
          index,
          siblingCount: nodes.length,
        });

        if (node.children?.length) {
          traverse(node.children, level + 1, node.id);
        }
      });
    };

    traverse(this.uiBuilder.elements(), 0, null);

    return result;
  });
  draggedElementId = signal<string | null>(null);
  dropHint = signal<DropContext | null>(null);
  canAddChildElements = computed(() => {
    const selected = this.selectedElement();
    if (!selected) {
      return true;
    }
    return selected.type === 'Container';
  });

  constructor(private uiBuilder: UiBuilderService) {
  }

  toggleCollapse() {
    this.uiBuilder.toggleSideMenuCollapsed();
  }

  addElement(type: UIElementTypes) {
    this.uiBuilder.addElement(type);
  }

  isAddButtonDisabled(_type: UIElementTypes): boolean {
    return !this.canAddChildElements();
  }

  getAddButtonTitle(type: UIElementTypes): string {
    const selected = this.selectedElement();
    if (!selected) {
      return `Add ${type} to root`;
    }

    if (selected.type !== 'Container') {
      return 'Select a container to add child elements';
    }

    return `Add ${type} to ${selected.name}`;
  }

  addAdvancedPreset(presetId: string) {
    this.uiBuilder.addAdvancedPresetRoot(presetId);
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

  toggleElementLock(event: MouseEvent, element: UIElement) {
    event.stopPropagation();
    this.uiBuilder.setElementLocked(element.id, !element.locked);
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


  toggleAdvancedPresetList() {
    this.showAdvancedPresets.update(value => !value);
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

  getIndentIndicator(level: number): string {
    if (level === 0) return '';
    return '└' + '─'.repeat(level - 1);
  }

  onDragStart(event: DragEvent, elementId: string): void {
    event.stopPropagation();
    this.draggedElementId.set(elementId);
    this.dropHint.set(null);
    event.dataTransfer?.setData('text/plain', elementId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragEnd(): void {
    this.draggedElementId.set(null);
    this.dropHint.set(null);
  }

  onDragOverZone(event: DragEvent, context: DropContext): void {
    if (!this.canAcceptDrop(context)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropHint.set(context);
  }

  onDragLeaveZone(_event: DragEvent, context: DropContext): void {
    const hint = this.dropHint();
    if (hint && hint.mode === context.mode && hint.targetId === context.targetId) {
      this.dropHint.set(null);
    }
  }

  onDropZone(event: DragEvent, context: DropContext): void {
    const draggedId = this.draggedElementId();
    if (!draggedId) {
      return;
    }

    if (!this.canAcceptDrop(context)) {
      this.onDragEnd();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetIndex = context.index ?? undefined;
    this.uiBuilder.moveElementToParent(draggedId, context.parentId, targetIndex);

    this.onDragEnd();
  }

  isDropHint(targetId: string | null, mode: DropMode): boolean {
    const hint = this.dropHint();
    return !!hint && hint.targetId === targetId && hint.mode === mode;
  }

  private canAcceptDrop(context: DropContext): boolean {
    const draggedId = this.draggedElementId();
    if (!draggedId) {
      return false;
    }

    if ((context.mode === 'before' || context.mode === 'after') && context.targetId === draggedId) {
      return false;
    }

    if (context.mode === 'child') {
      if (!context.parentId) {
        return false;
      }
      const parent = this.uiBuilder.findElementById(context.parentId);
      if (!parent || parent.type !== 'Container') {
        return false;
      }
    }

    return this.isDropAllowed(draggedId, context.parentId);
  }

  private isDropAllowed(draggedId: string, targetParentId: string | null): boolean {
    if (targetParentId === draggedId) {
      return false;
    }

    if (targetParentId === null) {
      return true;
    }

    const parent = this.uiBuilder.findElementById(targetParentId);
    if (!parent || parent.type !== 'Container') {
      return false;
    }

    if (this.isDescendant(draggedId, targetParentId)) {
      return false;
    }

    return true;
  }

  private isDescendant(ancestorId: string, descendantId: string): boolean {
    const ancestor = this.uiBuilder.findElementById(ancestorId);
    if (!ancestor?.children?.length) {
      return false;
    }

    const stack = [...ancestor.children];
    while (stack.length) {
      const node = stack.pop();
      if (!node) {
        continue;
      }
      if (node.id === descendantId) {
        return true;
      }
      if (node.children?.length) {
        stack.push(...node.children);
      }
    }

    return false;
  }
}