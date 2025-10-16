import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, computed } from '@angular/core';
import { UiBuilderService } from '../services/ui-builder.service';
import { UIElement, UIAnchor } from '../../models/types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss'
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: false }) canvasElement!: ElementRef<HTMLDivElement>;

  // Canvas dimensions (scaled down from 1920x1080)
  private readonly targetWidth = 1920;
  private readonly targetHeight = 1080;
  private scale = 0.5; // Scale factor for display
  private readonly minScale = 0.25;
  private readonly maxScale = 2;
  private readonly zoomStep = 0.15;

  get canvasWidth(): number {
    return this.targetWidth * this.scale;
  }

  get canvasHeight(): number {
    return this.targetHeight * this.scale;
  }

  get scalePercent(): number {
    return Math.round(this.scale * 100);
  }

  elements = computed(() => this.uiBuilder.elements());
  selectedElementId = computed(() => this.uiBuilder.selectedElementId());
  canvasStyle = computed(() => {
    const mode = this.uiBuilder.canvasBackgroundMode();
    const style: Record<string, string> = {
      backgroundColor: '#000000',
      backgroundImage: 'none',
    };

    if (mode === 'white') {
      style['backgroundColor'] = '#ffffff';
    } else if (mode === 'image') {
      const imageUrl = this.uiBuilder.canvasBackgroundImageUrl();
      if (imageUrl) {
        style['backgroundColor'] = '#000000';
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

  // Resize state
  isResizing = false;
  resizeElement: UIElement | null = null;
  resizeDirection: 'right' | 'bottom' | 'corner' | null = null;
  private resizeStartSize = { width: 0, height: 0 };
  private resizeStartMouse = { x: 0, y: 0 };

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

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('keydown', this.boundKeyDown);

    if (this.canvasContainer) {
      this.canvasContainer.nativeElement.removeEventListener('wheel', this.boundWheel);
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
    const previousScale = this.scale;
    const zoomMultiplier = event.deltaY < 0 ? 1 + this.zoomStep : 1 / (1 + this.zoomStep);
  this.updateScale(previousScale * zoomMultiplier);

    const scaleRatio = this.scale / previousScale;

    if (scaleRatio === 1) {
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const offsetX = event.clientX - containerRect.left + containerEl.scrollLeft;
    const offsetY = event.clientY - containerRect.top + containerEl.scrollTop;

    containerEl.scrollLeft = offsetX * scaleRatio - (event.clientX - containerRect.left);
    containerEl.scrollTop = offsetY * scaleRatio - (event.clientY - containerRect.top);
  }

  private updateScale(nextScale: number) {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, nextScale));

    if (!isFinite(clamped) || clamped <= 0) {
      return;
    }

    if (Math.abs(clamped - this.scale) < 0.0001) {
      return;
    }

    this.scale = clamped;
  }

  onCanvasClick(event: MouseEvent) {
    // Only deselect if clicking on canvas background and not dragging
    if (event.target === this.canvasElement.nativeElement && !this.isDragging) {
      this.uiBuilder.selectElement(null);
    }
  }

  onElementClick(event: MouseEvent, elementId: string) {
    event.stopPropagation();
    if (!this.isDragging) {
      this.uiBuilder.selectElement(elementId);
    }
  }

  onElementMouseDown(event: MouseEvent, elementId: string) {
    event.preventDefault();
    event.stopPropagation();
    
    // Select the element if not already selected
    if (this.selectedElementId() !== elementId) {
      this.uiBuilder.selectElement(elementId);
    }

    const element = this.uiBuilder.findElementById(elementId);
    if (!element) return;

    // Start dragging
    this.isDragging = true;
    this.dragElement = element;
    
    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    
    // Calculate mouse position relative to canvas in game coordinates
    const mouseGameX = (event.clientX - canvasRect.left) / this.scale;
    const mouseGameY = (event.clientY - canvasRect.top) / this.scale;
    
    // Get element's current game position (anchor start + position offset)
    const elementGamePosition = this.getElementGamePosition(element);
    
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

    // Start resizing
    this.isResizing = true;
    this.resizeElement = element;
    this.resizeDirection = direction;
    
    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    
    // Store starting mouse position in game coordinates
    this.resizeStartMouse.x = (event.clientX - canvasRect.left) / this.scale;
    this.resizeStartMouse.y = (event.clientY - canvasRect.top) / this.scale;
    
    // Store starting size
    this.resizeStartSize.width = element.size[0];
    this.resizeStartSize.height = element.size[1];
  }

  private onMouseMove(event: MouseEvent) {
    const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
    const mouseGameX = (event.clientX - canvasRect.left) / this.scale;
    const mouseGameY = (event.clientY - canvasRect.top) / this.scale;

    // Handle dragging
    if (this.isDragging && this.dragElement) {
      // Calculate new element position by subtracting drag offset
      const newElementGameX = mouseGameX - this.dragOffset.x;
      const newElementGameY = mouseGameY - this.dragOffset.y;
      
      // Convert from absolute game position to position relative to anchor
      const newPosition = this.calculateAnchorAdjustedPosition(
        newElementGameX,
        newElementGameY,
        this.dragElement
      );
      
      // Update element position
      this.uiBuilder.updateElement(this.dragElement.id, {
        position: [newPosition.x, newPosition.y]
      });
    }

    // Handle resizing
    if (this.isResizing && this.resizeElement && this.resizeDirection) {
      const deltaX = mouseGameX - this.resizeStartMouse.x;
      const deltaY = mouseGameY - this.resizeStartMouse.y;

      let newWidth = this.resizeStartSize.width;
      let newHeight = this.resizeStartSize.height;

      // Calculate new size based on resize direction
      if (this.resizeDirection === 'right' || this.resizeDirection === 'corner') {
        newWidth = Math.max(10, this.resizeStartSize.width + deltaX); // Minimum width of 10
      }
      
      if (this.resizeDirection === 'bottom' || this.resizeDirection === 'corner') {
        newHeight = Math.max(10, this.resizeStartSize.height + deltaY); // Minimum height of 10
      }

      // Update element size
      this.uiBuilder.updateElement(this.resizeElement.id, {
        size: [newWidth, newHeight]
      });
    }
  }

  private onMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragElement = null;
    }
    
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeElement = null;
      this.resizeDirection = null;
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    // Handle Delete key
    if (event.key === 'Delete' || event.key === 'Del') {
      const selectedId = this.selectedElementId();
      if (selectedId) {
        this.deleteSelectedElement();
      }
    }
  }

  private deleteSelectedElement() {
    const selectedId = this.selectedElementId();
    if (!selectedId) return;

    const element = this.uiBuilder.findElementById(selectedId);
    if (!element) return;

    const hasChildren = element.children && element.children.length > 0;
    
    // Show confirmation dialog if element has children
    if (hasChildren) {
      const childCount = element.children!.length;
      const message = `Delete "${element.name}"?\n\nThis element contains ${childCount} child element${childCount > 1 ? 's' : ''} that will also be deleted.`;
      
      if (confirm(message)) {
        this.uiBuilder.removeElement(selectedId);
      }
    } else {
      // No children, delete immediately
      this.uiBuilder.removeElement(selectedId);
    }
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
    const width = parentElement ? parentElement.size[0] : this.targetWidth;
    const height = parentElement ? parentElement.size[1] : this.targetHeight;
    
    switch (anchor) {
      case UIAnchor.TopLeft:
        return { x: 0, y: 0 };
      case UIAnchor.TopCenter:
        return { x: width / 2, y: 0 };
      case UIAnchor.TopRight:
        return { x: width, y: 0 };
      case UIAnchor.CenterLeft:
        return { x: 0, y: height / 2 };
      case UIAnchor.Center:
        return { x: width / 2, y: height / 2 };
      case UIAnchor.CenterRight:
        return { x: width, y: height / 2 };
      case UIAnchor.BottomLeft:
        return { x: 0, y: height };
      case UIAnchor.BottomCenter:
        return { x: width / 2, y: height };
      case UIAnchor.BottomRight:
        return { x: width, y: height };
      default:
        return { x: 0, y: 0 };
    }
  }

  private getAnchorOffset(anchor: UIAnchor, size: number[]): { x: number, y: number } {
    const [width, height] = size;
    let offsetX = 0;
    let offsetY = 0;

    switch (anchor) {
      case UIAnchor.TopCenter:
      case UIAnchor.Center:
      case UIAnchor.BottomCenter:
        offsetX = -width / 2;
        break;
      case UIAnchor.TopRight:
      case UIAnchor.CenterRight:
      case UIAnchor.BottomRight:
        offsetX = -width;
        break;
      default:
        offsetX = 0;
    }

    switch (anchor) {
      case UIAnchor.CenterLeft:
      case UIAnchor.Center:
      case UIAnchor.CenterRight:
        offsetY = -height / 2;
        break;
      case UIAnchor.BottomLeft:
      case UIAnchor.BottomCenter:
      case UIAnchor.BottomRight:
        offsetY = -height;
        break;
      default:
        offsetY = 0;
    }

    return { x: offsetX, y: offsetY };
  }

  private getTextAlignment(anchor: UIAnchor): {
    justifyContent: 'flex-start' | 'center' | 'flex-end';
    alignItems: 'flex-start' | 'center' | 'flex-end';
    textAlign: 'left' | 'center' | 'right';
  } {
    let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
    let alignItems: 'flex-start' | 'center' | 'flex-end' = 'center';
    let textAlign: 'left' | 'center' | 'right' = 'center';

    switch (anchor) {
      case UIAnchor.TopLeft:
      case UIAnchor.CenterLeft:
      case UIAnchor.BottomLeft:
        justifyContent = 'flex-start';
        textAlign = 'left';
        break;
      case UIAnchor.TopCenter:
      case UIAnchor.Center:
      case UIAnchor.BottomCenter:
        justifyContent = 'center';
        textAlign = 'center';
        break;
      case UIAnchor.TopRight:
      case UIAnchor.CenterRight:
      case UIAnchor.BottomRight:
        justifyContent = 'flex-end';
        textAlign = 'right';
        break;
    }

    switch (anchor) {
      case UIAnchor.TopLeft:
      case UIAnchor.TopCenter:
      case UIAnchor.TopRight:
        alignItems = 'flex-start';
        break;
      case UIAnchor.CenterLeft:
      case UIAnchor.Center:
      case UIAnchor.CenterRight:
        alignItems = 'center';
        break;
      case UIAnchor.BottomLeft:
      case UIAnchor.BottomCenter:
      case UIAnchor.BottomRight:
        alignItems = 'flex-end';
        break;
    }

    return { justifyContent, alignItems, textAlign };
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

  getElementStyle(element: UIElement, parent?: UIElement): any {
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

  private calculatePosition(element: UIElement, parent?: UIElement): { x: number, y: number } {
    const elementAbsolute = this.getAbsoluteGamePosition(element);

    if (!parent) {
      return {
        x: elementAbsolute.x * this.scale,
        y: elementAbsolute.y * this.scale
      };
    }

    const parentAbsolute = this.getAbsoluteGamePosition(parent);

    return {
      x: (elementAbsolute.x - parentAbsolute.x) * this.scale,
      y: (elementAbsolute.y - parentAbsolute.y) * this.scale
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
      width: width * this.scale,
      height: height * this.scale
    };
  }

  getBackgroundStyle(element: UIElement): any {
    const [r, g, b] = element.bgColor;
    return {
      backgroundColor: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${element.bgAlpha})`,
      padding: `${element.padding}px`,
    };
  }

  getTextStyle(element: UIElement): any {
    const [r, g, b] = element.textColor;
    const alignment = this.getTextAlignment(element.textAnchor);
    return {
      color: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${element.textAlpha})`,
      fontSize: `${element.textSize * this.scale}px`,
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
    const [r, g, b] = element.imageColor;
    return {
      color: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${element.imageAlpha})`,
      padding: `${element.padding}px`,
    };
  }

  getButtonStyle(element: UIElement): any {
    const [r, g, b] = element.buttonColorBase;
    const [tr, tg, tb] = element.textColor;
    return {
      backgroundColor: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${element.buttonAlphaBase})`,
      color: `rgba(${Math.round(tr * 255)}, ${Math.round(tg * 255)}, ${Math.round(tb * 255)}, ${element.textAlpha})`,
      fontSize: `${element.textSize * this.scale}px`,
      padding: `${element.padding}px`,
    };
  }
}