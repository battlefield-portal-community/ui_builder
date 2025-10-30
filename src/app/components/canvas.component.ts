import { Component, ElementRef, ViewChild, AfterViewInit, computed, signal } from '@angular/core';
import { UiBuilderService } from '../services/ui-builder.service';
import { UIElement, UIAnchor, CANVAS_WIDTH, CANVAS_HEIGHT, UIRect, UIBgFill } from '../../models/types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss'
})
export class CanvasComponent implements AfterViewInit {
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: false }) canvasElement!: ElementRef<HTMLDivElement>;

  // Canvas dimensions (scaled down from 1920x1080)
  readonly scale = signal(0.5); // Scale factor for display
  private readonly minScale = 0.25;
  private readonly maxScale = 2;
  private readonly zoomStep = 0.15;
  private readonly snapThreshold = 8;
  private readonly canvasRect: UIRect = {
    left: 0,
    top: 0,
    right: CANVAS_WIDTH,
    bottom: CANVAS_HEIGHT,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    centerX: CANVAS_WIDTH / 2,
    centerY: CANVAS_HEIGHT / 2,
  };
  readonly snapGuides = signal<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  readonly canvasWidth = computed(() => CANVAS_WIDTH * this.scale());
  readonly canvasHeight = computed(() => CANVAS_HEIGHT * this.scale());
  readonly scalePercent = computed(() => Math.round(this.scale() * 100));

  elements = computed(() => this.uiBuilder.elements());
  selectedElementId = computed(() => this.uiBuilder.selectedElementId());
  selectedElementIds = computed(() => this.uiBuilder.selectedElementIds());
  selectedElementIdSet = computed(() => new Set(this.selectedElementIds()));
  showContainerLabels = computed(() => this.uiBuilder.showContainerLabels());
  canvasStyle = computed(() => {
    const mode = this.uiBuilder.canvasBackgroundMode();
    const style: Record<string, string> = {
      backgroundColor: '#000000',
      backgroundImage: 'none',
    };

    if (mode === 'white') {
      style['background-color'] = '#ffffff';
    } else if (mode === 'image') {
      const imageUrl = this.uiBuilder.canvasBackgroundImageUrl();
      if (imageUrl) {
        style['background-color'] = '#000000';
        style['backgroundImage'] = `url(${imageUrl})`;
        style['backgroundSize'] = 'cover';
        style['backgroundPosition'] = 'center center';
        style['backgroundRepeat'] = 'no-repeat';
      }
    }

    return style;
  });

  // Drag and drop state
  isDragging = false;
  dragElement: UIElement | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragStartPosition = { x: 0, y: 0 };
  private dragPointerStart = { x: 0, y: 0 };
  private dragElementStartAbsolute = { x: 0, y: 0 };
  private multiDragElements: Array<{ id: string; element: UIElement; absoluteX: number; absoluteY: number }> = [];

  // Resize state
  isResizing = false;
  resizeElement: UIElement | null = null;
  resizeDirection: 'right' | 'bottom' | 'corner' | null = null;
  private resizeStartSize = { width: 0, height: 0 };
  private resizeStartMouse = { x: 0, y: 0 };

  // Canvas panning state
  isPanning = false;
  private panStart = { x: 0, y: 0 };
  private panScrollStart = { left: 0, top: 0 };
  private suppressNextCanvasClick = false;

  // Bound event handlers for cleanup
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);
  private boundKeyDown = this.onKeyDown.bind(this);
  private boundWheel = (event: WheelEvent) => this.onCanvasWheel(event);
  constructor(private uiBuilder: UiBuilderService) {}

  ngAfterViewInit() {
    // Set up mouse event listeners for drag and drop
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    
    // Set up keyboard event listener for delete key
    document.addEventListener('keydown', this.boundKeyDown);

    if (this.canvasContainer) {
      this.canvasContainer.nativeElement.addEventListener('wheel', this.boundWheel, { passive: false });
    }
  }

  private onCanvasWheel(event: WheelEvent) {
    if (!this.canvasContainer) {
      return;
    }

    // Avoid hijacking browser zoom when modifier keys are pressed
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();

    const containerEl = this.canvasContainer.nativeElement;
    const canvasEl = this.canvasElement.nativeElement;
    const canvasRect = canvasEl.getBoundingClientRect();
    const pointerOffsetX = event.clientX - canvasRect.left;
    const pointerOffsetY = event.clientY - canvasRect.top;
    const safeOffsetX = Math.min(Math.max(pointerOffsetX, 0), canvasRect.width || 0);
    const safeOffsetY = Math.min(Math.max(pointerOffsetY, 0), canvasRect.height || 0);
    const previousScrollLeft = containerEl.scrollLeft;
    const previousScrollTop = containerEl.scrollTop;
    const previousScale = this.scale();
    const zoomMultiplier = event.deltaY < 0 ? 1 + this.zoomStep : 1 / (1 + this.zoomStep);
    this.updateScale(previousScale * zoomMultiplier);

    const scaleRatio = this.scale() / previousScale;

    if (scaleRatio === 1) {
      return;
    }

    const nextScrollLeft = safeOffsetX * scaleRatio - safeOffsetX + previousScrollLeft;
    const nextScrollTop = safeOffsetY * scaleRatio - safeOffsetY + previousScrollTop;

    containerEl.scrollLeft = nextScrollLeft;
    containerEl.scrollTop = nextScrollTop;

    this.normalizeScrollPosition(containerEl, canvasEl);
  }

  private updateScale(nextScale: number) {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, nextScale));

    if (!isFinite(clamped) || clamped <= 0) {
      return;
    }

    if (Math.abs(clamped - this.scale()) < 0.0001) {
      return;
    }

    this.scale.set(clamped);
  }

  private normalizeScrollPosition(
    containerEl: HTMLDivElement,
    canvasEl: HTMLDivElement
  ): void {
    const maxScrollLeft = Math.max(0, canvasEl.offsetWidth - containerEl.clientWidth);
    const maxScrollTop = Math.max(0, canvasEl.offsetHeight - containerEl.clientHeight);

    if (maxScrollLeft === 0) {
      containerEl.scrollLeft = 0;
    } else if (containerEl.scrollLeft < 0 || containerEl.scrollLeft > maxScrollLeft) {
      containerEl.scrollLeft = Math.min(Math.max(containerEl.scrollLeft, 0), maxScrollLeft);
    }

    if (maxScrollTop === 0) {
      containerEl.scrollTop = 0;
    } else if (containerEl.scrollTop < 0 || containerEl.scrollTop > maxScrollTop) {
      containerEl.scrollTop = Math.min(Math.max(containerEl.scrollTop, 0), maxScrollTop);
    }
  }

  onCanvasClick(event: MouseEvent) {
    if (this.suppressNextCanvasClick) {
      this.suppressNextCanvasClick = false;
      return;
    }

    // Only deselect if clicking on canvas background and not dragging
    if (event.target === this.canvasElement.nativeElement && !this.isDragging) {
      this.uiBuilder.selectElement(null);
    }
  }

  onCanvasMouseDown(event: MouseEvent) {
    if (!this.canvasContainer) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const containerEl = this.canvasContainer.nativeElement;

    this.isPanning = true;
    this.suppressNextCanvasClick = false;
    this.panStart.x = event.clientX;
    this.panStart.y = event.clientY;
    this.panScrollStart.left = containerEl.scrollLeft;
    this.panScrollStart.top = containerEl.scrollTop;
  }

  onElementClick(event: MouseEvent, elementId: string) {
    event.stopPropagation();
    if (this.isDragging) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    this.uiBuilder.selectElement(elementId);
  }

  onElementMouseDown(event: MouseEvent, elementId: string) {
    event.preventDefault();
    event.stopPropagation();

    const isToggleSelection = event.ctrlKey || event.metaKey;

    if (isToggleSelection) {
      this.uiBuilder.toggleElementSelection(elementId);
      return;
    }

    const selectionHasElement = this.selectedElementIdSet().has(elementId);
    const selectedIds = this.selectedElementIds();
    const hasMultipleSelection = selectedIds.length > 1;

    if (!selectionHasElement) {
      this.uiBuilder.selectElement(elementId);
    } else if (!hasMultipleSelection && this.selectedElementId() !== elementId) {
      this.uiBuilder.selectElement(elementId);
    }

    const element = this.uiBuilder.findElementById(elementId);
    if (!element) return;

    if (element.locked) {
      return;
    }

    // Start dragging
    this.isDragging = true;
    this.dragElement = element;
    
    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    
    // Calculate mouse position relative to canvas in game coordinates
    const mouseGameX = (event.clientX - canvasRect.left) / this.scale();
    const mouseGameY = (event.clientY - canvasRect.top) / this.scale();

    this.dragPointerStart.x = mouseGameX;
    this.dragPointerStart.y = mouseGameY;
    
    // Get element's current game position (anchor start + position offset)
    const elementGamePosition = this.getElementGamePosition(element);

    const selectionIds = this.selectedElementIds();
    const idsToInclude = selectionIds.length ? selectionIds : [elementId];
    const seenIds = new Set<string>();

    this.multiDragElements = [];

    for (const id of idsToInclude) {
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      const selectedElement = this.uiBuilder.findElementById(id);
      if (!selectedElement || selectedElement.locked) {
        continue;
      }

      const absolutePosition = this.getAbsoluteGamePosition(selectedElement);
      this.multiDragElements.push({
        id,
        element: selectedElement,
        absoluteX: absolutePosition.x,
        absoluteY: absolutePosition.y,
      });
    }

    let dragEntry = this.multiDragElements.find(entry => entry.id === elementId);
    if (!dragEntry) {
      dragEntry = {
        id: element.id,
        element,
        absoluteX: elementGamePosition.x,
        absoluteY: elementGamePosition.y,
      };
      this.multiDragElements.push(dragEntry);
    }

    this.dragElementStartAbsolute.x = dragEntry.absoluteX;
    this.dragElementStartAbsolute.y = dragEntry.absoluteY;
    
    // Calculate offset from mouse to element's position in game coordinates
    this.dragOffset.x = mouseGameX - elementGamePosition.x;
    this.dragOffset.y = mouseGameY - elementGamePosition.y;
    
    // Store the starting position for comparison
    this.dragStartPosition.x = element.position[0];
    this.dragStartPosition.y = element.position[1];
  }

  onResizeStart(event: MouseEvent, elementId: string, direction: 'right' | 'bottom' | 'corner') {
    event.preventDefault();
    event.stopPropagation();
    
    // Select the element if not already selected
    if (this.selectedElementId() !== elementId) {
      this.uiBuilder.selectElement(elementId);
    }

    const element = this.uiBuilder.findElementById(elementId);
    if (!element) return;

    if (element.locked) {
      return;
    }

    // Start resizing
    this.isResizing = true;
    this.resizeElement = element;
    this.resizeDirection = direction;
    
    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    
    // Store starting mouse position in game coordinates
    this.resizeStartMouse.x = (event.clientX - canvasRect.left) / this.scale();
    this.resizeStartMouse.y = (event.clientY - canvasRect.top) / this.scale();
    
    // Store starting size
    this.resizeStartSize.width = element.size[0];
    this.resizeStartSize.height = element.size[1];
  }

  private onMouseMove(event: MouseEvent) {
    if (this.isPanning && this.canvasContainer && this.canvasElement) {
      const containerEl = this.canvasContainer.nativeElement;
      const canvasEl = this.canvasElement.nativeElement;
      const deltaX = event.clientX - this.panStart.x;
      const deltaY = event.clientY - this.panStart.y;

      containerEl.scrollLeft = this.panScrollStart.left - deltaX;
      containerEl.scrollTop = this.panScrollStart.top - deltaY;
      this.normalizeScrollPosition(containerEl, canvasEl);

      if (!this.suppressNextCanvasClick && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        this.suppressNextCanvasClick = true;
      }

      return;
    }

    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    const mouseGameX = (event.clientX - canvasRect.left) / this.scale();
    const mouseGameY = (event.clientY - canvasRect.top) / this.scale();

    if (!this.isDragging) {
      this.clearSnapGuides();
    }

    // Handle dragging
    if (this.isDragging && this.dragElement && !this.dragElement.locked) {
      const dragEntry = this.multiDragElements.find(entry => entry.id === this.dragElement?.id);
      if (!dragEntry) {
        return;
      }

      const movingIds = this.multiDragElements.length > 1
        ? new Set(this.multiDragElements.map(entry => entry.id))
        : undefined;

      const newElementGameX = mouseGameX - this.dragOffset.x;
      const newElementGameY = mouseGameY - this.dragOffset.y;
      const snappedPosition = this.applySnapping(this.dragElement, newElementGameX, newElementGameY, movingIds);

      const deltaX = snappedPosition.x - this.dragElementStartAbsolute.x;
      const deltaY = snappedPosition.y - this.dragElementStartAbsolute.y;

      for (const entry of this.multiDragElements) {
        const targetElement = entry.id === this.dragElement.id ? this.dragElement : entry.element;
        if (!targetElement || targetElement.locked) {
          continue;
        }

        const targetAbsoluteX = entry.id === this.dragElement.id
          ? snappedPosition.x
          : entry.absoluteX + deltaX;
        const targetAbsoluteY = entry.id === this.dragElement.id
          ? snappedPosition.y
          : entry.absoluteY + deltaY;

        const newPosition = this.calculateAnchorAdjustedPosition(
          targetAbsoluteX,
          targetAbsoluteY,
          targetElement
        );

        this.uiBuilder.updateElement(targetElement.id, {
          position: [
            this.roundValue(newPosition.x, 2),
            this.roundValue(newPosition.y, 2)
          ]
        });
      }
    }

    // Handle resizing
    if (this.isResizing && this.resizeElement && this.resizeDirection) {
      if (this.resizeElement.locked) {
        return;
      }

      const deltaX = mouseGameX - this.resizeStartMouse.x;
      const deltaY = mouseGameY - this.resizeStartMouse.y;

      let newWidth = this.resizeStartSize.width;
      let newHeight = this.resizeStartSize.height;

      // Calculate new size based on resize direction
      if (this.resizeDirection === 'right' || this.resizeDirection === 'corner') {
        newWidth = this.roundValue(Math.max(1, this.resizeStartSize.width + deltaX), 2); // Minimum width of 10
      }
      
      if (this.resizeDirection === 'bottom' || this.resizeDirection === 'corner') {
        newHeight = this.roundValue(Math.max(1, this.resizeStartSize.height + deltaY), 2); // Minimum height of 10
      }

      // Update element size
      this.uiBuilder.updateElement(this.resizeElement.id, {
        size: [newWidth, newHeight]
      });
    }
  }

  private onMouseUp(event: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.suppressNextCanvasClick) {
        setTimeout(() => {
          this.suppressNextCanvasClick = false;
        });
      }
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.dragElement = null;
      this.multiDragElements = [];
    }
    
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeElement = null;
      this.resizeDirection = null;
    }

    this.clearSnapGuides();
  }

  private onKeyDown(event: KeyboardEvent) {
    if (!this.shouldHandleGlobalShortcut(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      if (this.uiBuilder.copySelection()) {
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 'v') {
      const pasted = this.uiBuilder.pasteCopiedElement();
      if (pasted && pasted.length) {
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 'g') {
      const wrapped = this.uiBuilder.wrapSelectionInContainer();
      if (wrapped) {
        event.preventDefault();
      }
      return;
    }

    if (key === 'delete' || key === 'del') {
      const selectedId = this.selectedElementId();
      if (selectedId) {
        this.deleteSelectedElement();
      }
    }
  }

  private shouldHandleGlobalShortcut(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return true;
    }

    const tagName = target.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return false;
    }

    if (target.isContentEditable) {
      return false;
    }

    return true;
  }

  private deleteSelectedElement() {
    const selectedIds = this.selectedElementIds();
    if (!selectedIds.length) {
      return;
    }

    const elements = selectedIds
      .map(id => this.uiBuilder.findElementById(id))
      .filter((item): item is UIElement => !!item);

    if (!elements.length) {
      return;
    }

    const withChildren = elements.filter(element => element.children?.length);
    
    if (elements.length === 1 && withChildren.length === 1) {
      const childCount = withChildren[0].children!.length;
      const message = `Delete "${elements[0].name}"?\n\nThis element contains ${childCount} child element${childCount > 1 ? 's' : ''} that will also be deleted.`;
      if (!confirm(message)) return;
    } else if (elements.length > 1) {
      const messageLines = [`Delete ${elements.length} selected elements?`];
      if (withChildren.length) {
        messageLines.push(`\n${withChildren.length} selected element${withChildren.length > 1 ? 's' : ''} contain child elements that will also be removed.`);
      }
      if (!confirm(messageLines.join(''))) return;
    }

    selectedIds.forEach(id => this.uiBuilder.removeElement(id));
  }

  private getElementGamePosition(element: UIElement): { x: number, y: number } {
    return this.getAbsoluteGamePosition(element);
  }

  private findParentElement(childId: string): UIElement | null {
    const search = (elements: UIElement[]): UIElement | null => {
      for (const element of elements) {
        if (element.children) {
          for (const child of element.children) {
            if (child.id === childId) {
              return element;
            }
          }
          // Recursively search in grandchildren
          const found = search(element.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.elements());
  }

  private getAnchorStartCoordinates(anchor: UIAnchor, parentElement?: UIElement | null): { x: number, y: number } {
    // Use parent dimensions if this is a child element, otherwise use canvas dimensions
    const width = parentElement?.size[0] ?? CANVAS_WIDTH;
    const height = parentElement?.size[1] ?? CANVAS_HEIGHT;
    
    const isLeft = [UIAnchor.TopLeft, UIAnchor.CenterLeft, UIAnchor.BottomLeft].includes(anchor);
    const isRight = [UIAnchor.TopRight, UIAnchor.CenterRight, UIAnchor.BottomRight].includes(anchor);
    const isTop = [UIAnchor.TopLeft, UIAnchor.TopCenter, UIAnchor.TopRight].includes(anchor);
    const isBottom = [UIAnchor.BottomLeft, UIAnchor.BottomCenter, UIAnchor.BottomRight].includes(anchor);

    return {
      x: isLeft ? 0 : isRight ? width : width / 2,
      y: isTop ? 0 : isBottom ? height : height / 2,
    };
  }

  private getAnchorOffset(anchor: UIAnchor, size: number[]): { x: number, y: number } {
    const [width, height] = size;
    
    const isLeft = [UIAnchor.TopLeft, UIAnchor.CenterLeft, UIAnchor.BottomLeft].includes(anchor);
    const isRight = [UIAnchor.TopRight, UIAnchor.CenterRight, UIAnchor.BottomRight].includes(anchor);
    const isTop = [UIAnchor.TopLeft, UIAnchor.TopCenter, UIAnchor.TopRight].includes(anchor);
    const isBottom = [UIAnchor.BottomLeft, UIAnchor.BottomCenter, UIAnchor.BottomRight].includes(anchor);

    return {
      x: isLeft ? 0 : isRight ? -width : -width / 2,
      y: isTop ? 0 : isBottom ? -height : -height / 2,
    };
  }

  private getTextAlignment(anchor: UIAnchor): {
    justifyContent: 'flex-start' | 'center' | 'flex-end';
    alignItems: 'flex-start' | 'center' | 'flex-end';
    textAlign: 'left' | 'center' | 'right';
  } {
    const isLeft = [UIAnchor.TopLeft, UIAnchor.CenterLeft, UIAnchor.BottomLeft].includes(anchor);
    const isRight = [UIAnchor.TopRight, UIAnchor.CenterRight, UIAnchor.BottomRight].includes(anchor);
    const isTop = [UIAnchor.TopLeft, UIAnchor.TopCenter, UIAnchor.TopRight].includes(anchor);
    const isBottom = [UIAnchor.BottomLeft, UIAnchor.BottomCenter, UIAnchor.BottomRight].includes(anchor);

    return {
      justifyContent: isLeft ? 'flex-start' : isRight ? 'flex-end' : 'center',
      alignItems: isTop ? 'flex-start' : isBottom ? 'flex-end' : 'center',
      textAlign: isLeft ? 'left' : isRight ? 'right' : 'center',
    };
  }

  private calculateAnchorAdjustedPosition(absoluteGameX: number, absoluteGameY: number, element: UIElement): { x: number, y: number } {
    const parentElement = this.findParentElement(element.id);
    const anchorOffset = this.getAnchorOffset(element.anchor, element.size);
    
    if (!parentElement) {
      // Root element: convert absolute position to local position relative to canvas anchor
      const anchorStart = this.getAnchorStartCoordinates(element.anchor, null);
      return {
        x: absoluteGameX - anchorStart.x - anchorOffset.x,
        y: absoluteGameY - anchorStart.y - anchorOffset.y
      };
    } else {
      // Child element: convert absolute position to local position relative to parent anchor
      const parentAbsolutePos = this.getAbsoluteGamePosition(parentElement);
      const anchorStart = this.getAnchorStartCoordinates(element.anchor, parentElement);
      
      // Convert to parent's local coordinate space, then subtract anchor offset
      const localX = absoluteGameX - parentAbsolutePos.x;
      const localY = absoluteGameY - parentAbsolutePos.y;
      
      return {
        x: localX - anchorStart.x - anchorOffset.x,
        y: localY - anchorStart.y - anchorOffset.y
      };
    }
  }

  getElementStyle(element: UIElement, parent?: UIElement | null): any {
    const position = this.calculatePosition(element, parent);
    const size = this.calculateSize(element);

    return {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      display: element.visible ? 'block' : 'none',
    };
  }

  private calculatePosition(element: UIElement, parent?: UIElement | null): { x: number, y: number } {
    const elementAbsolute = this.getAbsoluteGamePosition(element);

    if (!parent) {
      return {
        x: elementAbsolute.x * this.scale(),
        y: elementAbsolute.y * this.scale()
      };
    }

    const parentAbsolute = this.getAbsoluteGamePosition(parent);

    return {
      x: (elementAbsolute.x - parentAbsolute.x) * this.scale(),
      y: (elementAbsolute.y - parentAbsolute.y) * this.scale()
    };
  }

  private getAbsoluteGamePosition(element: UIElement): { x: number, y: number } {
    const [x, y] = element.position;
    const parentElement = this.findParentElement(element.id);
    const anchorOffset = this.getAnchorOffset(element.anchor, element.size);
    
    if (!parentElement) {
      // Root element: position is relative to canvas with anchor
      const anchorStart = this.getAnchorStartCoordinates(element.anchor, null);
      return {
        x: anchorStart.x + anchorOffset.x + x,
        y: anchorStart.y + anchorOffset.y + y
      };
    } else {
      // Child element: position is relative to parent with anchor
      const anchorStart = this.getAnchorStartCoordinates(element.anchor, parentElement);
      const parentAbsolutePos = this.getAbsoluteGamePosition(parentElement);
      
      return {
        x: parentAbsolutePos.x + anchorStart.x + anchorOffset.x + x,
        y: parentAbsolutePos.y + anchorStart.y + anchorOffset.y + y
      };
    }
  }

  private calculateSize(element: UIElement): { width: number, height: number } {
    const [width, height] = element.size;
    return {
      width: width * this.scale(),
      height: height * this.scale()
    };
  }

  private getSiblingRectsForSnapping(elementId: string, excludeIds?: Set<string>): UIRect[] {
    const location = this.uiBuilder.getElementLocation(elementId);
    const parentId = location?.parentId ?? null;
    const allBounds = this.uiBuilder.elementBounds();
    const siblingRects = allBounds
      .filter(bounds => {
        if (bounds.parentId !== parentId) {
          return false;
        }
        if (bounds.id === elementId) {
          return false;
        }
        if (excludeIds?.has(bounds.id)) {
          return false;
        }
        return true;
      })
      .map(bounds => bounds.rect);

    if (parentId) {
      const parentBounds = this.uiBuilder.getElementBounds(parentId);
      if (parentBounds) {
        siblingRects.push(parentBounds.rect);
      }
    } else {
      siblingRects.push(this.canvasRect);
    }

    return siblingRects;
  }

  private updateSnapGuides(verticalGuide: number | null, horizontalGuide: number | null): void {
    this.snapGuides.set({
      vertical: verticalGuide !== null ? [verticalGuide * this.scale()] : [],
      horizontal: horizontalGuide !== null ? [horizontalGuide * this.scale()] : [],
    });
  }

  private clearSnapGuides(): void {
    this.snapGuides.set({ vertical: [], horizontal: [] });
  }

  private applySnapping(
    element: UIElement,
    proposedX: number,
    proposedY: number,
    excludeIds?: Set<string>
  ): { x: number; y: number } {
    if (!this.uiBuilder.snapToElements()) {
      this.clearSnapGuides();
      return { x: proposedX, y: proposedY };
    }

    const candidateRects = this.getSiblingRectsForSnapping(element.id, excludeIds);

    if (!candidateRects.length) {
      this.clearSnapGuides();
      return { x: proposedX, y: proposedY };
    }

    const [width, height] = element.size;
    const elementEdges = {
      left: proposedX,
      right: proposedX + width,
      centerX: proposedX + width / 2,
      top: proposedY,
      bottom: proposedY + height,
      centerY: proposedY + height / 2,
    };

    let snappedX = proposedX;
    let snappedY = proposedY;
    let bestHorizontalDiff = this.snapThreshold + 1;
    let bestVerticalDiff = this.snapThreshold + 1;
    let verticalGuide: number | null = null;
    let horizontalGuide: number | null = null;

    const snapChecks = [
      { edge: 'left', axis: 'x', guide: 'vertical' },
      { edge: 'right', axis: 'x', guide: 'vertical' },
      { edge: 'centerX', axis: 'x', guide: 'vertical' },
      { edge: 'top', axis: 'y', guide: 'horizontal' },
      { edge: 'bottom', axis: 'y', guide: 'horizontal' },
      { edge: 'centerY', axis: 'y', guide: 'horizontal' },
    ] as const;

    for (const rect of candidateRects) {
      for (const { edge, axis, guide } of snapChecks) {
        const isHorizontal = axis === 'x';
        const elementValue = elementEdges[edge];
        const rectValue = rect[edge];
        const diff = Math.abs(rectValue - elementValue);

        if (diff > this.snapThreshold) continue;

        const bestDiff = isHorizontal ? bestHorizontalDiff : bestVerticalDiff;
        if (diff >= bestDiff) continue;

        if (isHorizontal) {
          bestHorizontalDiff = diff;
          snappedX = edge === 'right' ? rectValue - width : edge === 'centerX' ? rectValue - width / 2 : rectValue;
          verticalGuide = rectValue;
        } else {
          bestVerticalDiff = diff;
          snappedY = edge === 'bottom' ? rectValue - height : edge === 'centerY' ? rectValue - height / 2 : rectValue;
          horizontalGuide = rectValue;
        }
      }
    }

    this.updateSnapGuides(
      bestHorizontalDiff <= this.snapThreshold ? verticalGuide : null,
      bestVerticalDiff <= this.snapThreshold ? horizontalGuide : null
    );

    return { x: snappedX, y: snappedY };
  }

  getBackgroundStyle(element: UIElement): any {
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const toRgba = (color: number[], alpha = clamp(element.bgAlpha)) =>
      `rgba(${color.map(c => Math.round(clamp(c) * 255)).join(', ')}, ${alpha})`;
    const adjust = (color: number[], factor: number): number[] =>
      color.map(c => clamp(factor > 0 ? c + (1 - c) * factor : c * (1 + factor)));

    const normalizedBg = element.bgColor.map(clamp);
    const baseFill = toRgba(normalizedBg);
    const borderColor = toRgba(normalizedBg, 1);
    const lighterStop = toRgba(adjust(normalizedBg, 0.25));
    const darkerStop = toRgba(adjust(normalizedBg, -0.2));

    const style: Record<string, string> = {
      padding: `${element.padding}px`,
      'background-color': 'transparent',
      'background-image': 'none',
      border: 'none',
      'backdrop-filter': 'none',
      '-webkit-backdrop-filter': 'none',
    };

    switch (element.bgFill) {
      case UIBgFill.None:
        style['border'] = '2px dotted rgba(150, 150, 150, 0.7)';
        break;
      case UIBgFill.Solid:
        style['background-color'] = baseFill;
        break;
      case UIBgFill.Blur: {
        const blurRadius = `${Math.max(6, Math.round(14 * this.scale()))}px`;
        style['background-color'] = baseFill;
        style['opacity'] = '0.8';
        style['backdrop-filter'] = `blur(${blurRadius})`;
        style['-webkit-backdrop-filter'] = `blur(${blurRadius})`;
        break;
      }
      case UIBgFill.OutlineThin:
        style['border'] = `1px solid ${borderColor}`;
        break;
      case UIBgFill.OutlineThick:
        style['border'] = `3px solid ${borderColor}`;
        break;
      case UIBgFill.GradientTop:
        style['background-image'] = `linear-gradient(to bottom, ${lighterStop}, ${darkerStop})`;
        break;
      case UIBgFill.GradientBottom:
        style['background-image'] = `linear-gradient(to top, ${lighterStop}, ${darkerStop})`;
        break;
      case UIBgFill.GradientLeft:
        style['background-image'] = `linear-gradient(to right, ${lighterStop}, ${darkerStop})`;
        break;
      case UIBgFill.GradientRight:
        style['background-image'] = `linear-gradient(to left, ${lighterStop}, ${darkerStop})`;
        break;
      default:
        style['background-color'] = baseFill;
        break;
    }

    return style;
  }

  private colorToRgba(color: number[], alpha: number): string {
    return `rgba(${color.map(c => Math.round(Math.min(1, Math.max(0, c)) * 255)).join(', ')}, ${alpha})`;
  }

  getTextStyle(element: UIElement): any {
    const alignment = this.getTextAlignment(element?.textAnchor ?? UIAnchor.Center);
    return {
      color: this.colorToRgba(element?.textColor ?? [1, 1, 1], element.textAlpha ?? 1),
      fontSize: `${(element?.textSize ?? 1) * this.scale()}px`,
      padding: `${element.padding}px`,
      display: 'flex',
      justifyContent: alignment.justifyContent,
      alignItems: alignment.alignItems,
      textAlign: alignment.textAlign,
      width: '100%',
      height: '100%',
      flex: '1 1 auto',
      pointerEvents: 'none',
    };
  }

  getImageStyle(element: UIElement): any {
    return {
      color: this.colorToRgba(element?.imageColor ?? [1, 1, 1], element.imageAlpha ?? 1),
      padding: `${element.padding}px`,
    };
  }

  getButtonStyle(element: UIElement): any {
    return {
      backgroundColor: this.colorToRgba(element?.buttonColorBase ?? [1, 1, 1], element.buttonAlphaBase ?? 1),
      color: this.colorToRgba(element?.textColor ?? [1, 1, 1], element.textAlpha ?? 1),
      fontSize: `${(element?.textSize ?? 1) * this.scale()}px`,
      padding: `${element.padding}px`,
    };
  }

  roundValue(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}