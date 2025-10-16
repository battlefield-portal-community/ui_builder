import { Injectable, computed, signal } from '@angular/core';
import {
  UIElement,
  UIElementTypes,
  DEFAULT_UI_PARAMS,
  UIAnchor,
  UIParams,
  UIBgFill,
  UIImageType,
  CanvasBackgroundMode,
  CanvasBackgroundAsset,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  UIElementBounds,
  UIRect,
} from '../../models/types';

const DEFAULT_CANVAS_BACKGROUND_IMAGE: CanvasBackgroundAsset = {
  id: 'default-grid',
  label: 'Game 1',
  fileName: 'ingame.jpg',
  url: 'assets/bg_canvas/ingame.jpg',
  source: 'default',
};

const defaultBackgroundMode: CanvasBackgroundMode = 'image';

function formatBackgroundLabel(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  return withoutExtension
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeAssetId(base: string, existing: CanvasBackgroundAsset[]): string {
  const sanitized = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  let candidate = sanitized;
  let suffix = 1;
  const ids = new Set(existing.map(asset => asset.id));

  while (ids.has(candidate) || candidate === DEFAULT_CANVAS_BACKGROUND_IMAGE.id) {
    candidate = `${sanitized}-${suffix++}`;
  }

  return candidate;
}

const RANDOM_NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRandomSuffix(length = 5): string {
  let result = '';
  for (let index = 0; index < length; index++) {
    const randomIndex = Math.floor(Math.random() * RANDOM_NAME_CHARS.length);
    result += RANDOM_NAME_CHARS.charAt(randomIndex);
  }
  return result;
}

export interface UIExportArtifacts {
  params: UIParams[];
  paramsJson: string;
  strings: Record<string, string>;
  stringsJson: string;
  typescriptCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class UiBuilderService {
  private _elements = signal<UIElement[]>([]);
  private _selectedElementId = signal<string | null>(null);
  private _nextId = 1;

  private _canvasBackgroundMode = signal<CanvasBackgroundMode>(defaultBackgroundMode);
  private _canvasBackgroundImage = signal<string | null>(DEFAULT_CANVAS_BACKGROUND_IMAGE.id);
  private _canvasBackgroundImages = signal<CanvasBackgroundAsset[]>([]);
  private _uploadedObjectUrls = new Set<string>();
  private _snapToElements = signal<boolean>(true);

  // Public readonly signals
  readonly elements = this._elements.asReadonly();
  readonly selectedElementId = this._selectedElementId.asReadonly();
  readonly canvasBackgroundMode = this._canvasBackgroundMode.asReadonly();
  readonly canvasBackgroundImage = this._canvasBackgroundImage.asReadonly();
  readonly canvasBackgroundImages = this._canvasBackgroundImages.asReadonly();
  readonly defaultCanvasBackgroundImageId = DEFAULT_CANVAS_BACKGROUND_IMAGE.id;
  readonly defaultCanvasBackgroundImage = DEFAULT_CANVAS_BACKGROUND_IMAGE;
  readonly snapToElements = this._snapToElements.asReadonly();
  readonly canvasBackgroundImageUrl = computed(() => {
    const imageId = this._canvasBackgroundImage();
    if (!imageId) {
      return DEFAULT_CANVAS_BACKGROUND_IMAGE.url;
    }

    if (imageId === DEFAULT_CANVAS_BACKGROUND_IMAGE.id) {
      return DEFAULT_CANVAS_BACKGROUND_IMAGE.url;
    }

    const match = this._canvasBackgroundImages().find(option => option.id === imageId);
    return match?.url ?? DEFAULT_CANVAS_BACKGROUND_IMAGE.url;
  });
  readonly elementBounds = computed(() => this.computeElementBounds());

  constructor() { }

  setSnapToElements(enabled: boolean): void {
    this._snapToElements.set(!!enabled);
  }

  toggleSnapToElements(): void {
    this._snapToElements.update(value => !value);
  }

  getElementBounds(elementId: string): UIElementBounds | null {
    return this.elementBounds().find(bounds => bounds.id === elementId) ?? null;
  }

  setCanvasBackgroundMode(mode: CanvasBackgroundMode): void {
    if (!['black', 'white', 'image'].includes(mode)) {
      return;
    }

    this._canvasBackgroundMode.set(mode);

    if (mode === 'image' && !this._canvasBackgroundImage()) {
      const first = this._canvasBackgroundImages()[0];
      this._canvasBackgroundImage.set(first?.id ?? DEFAULT_CANVAS_BACKGROUND_IMAGE.id);
    }
  }

  setCanvasBackgroundImage(imageId: string): void {
    if (!imageId) {
      return;
    }

    if (imageId === DEFAULT_CANVAS_BACKGROUND_IMAGE.id) {
      this._canvasBackgroundImage.set(DEFAULT_CANVAS_BACKGROUND_IMAGE.id);
    } else {
      const match = this._canvasBackgroundImages().find(option => option.id === imageId);
      if (!match) {
        return;
      }
      this._canvasBackgroundImage.set(match.id);
    }

    if (this._canvasBackgroundMode() !== 'image') {
      this._canvasBackgroundMode.set('image');
    }
  }

  addCanvasBackgroundImageFromPath(
    path: string,
    options?: { label?: string; id?: string; fileName?: string }
  ): CanvasBackgroundAsset | null {
    const trimmed = path.trim();
    if (!trimmed) {
      return null;
    }

    const existing = this._canvasBackgroundImages();
    if (existing.some(asset => asset.url === trimmed || asset.id === trimmed)) {
      return existing.find(asset => asset.url === trimmed || asset.id === trimmed) ?? null;
    }

    const rawFileName = options?.fileName ?? trimmed.split(/[\\/]/).pop() ?? trimmed;
    const idBase = options?.id ?? rawFileName.replace(/\.[^/.]+$/, '');
    const id = normalizeAssetId(idBase, existing);
    const label = options?.label ?? formatBackgroundLabel(rawFileName);

    const asset: CanvasBackgroundAsset = {
      id,
      label,
      fileName: rawFileName,
      url: trimmed,
      source: 'custom',
    };

    this._canvasBackgroundImages.set([...existing, asset]);

    if (this._canvasBackgroundMode() === 'image' && this._canvasBackgroundImage() === null) {
      this._canvasBackgroundImage.set(asset.id);
    }

    return asset;
  }

  addCanvasBackgroundImageFromFile(file: File): CanvasBackgroundAsset | null {
    const objectUrl = URL.createObjectURL(file);
    const asset = this.addCanvasBackgroundImageFromPath(objectUrl, {
      label: file.name,
      id: file.name.replace(/\.[^/.]+$/, ''),
      fileName: file.name,
    });

    if (!asset) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    this._uploadedObjectUrls.add(objectUrl);
    asset.source = 'upload';
    return asset;
  }

  removeCanvasBackgroundImage(imageId: string): void {
    const current = this._canvasBackgroundImages();
    const match = current.find(asset => asset.id === imageId);
    if (!match) {
      return;
    }

    const next = current.filter(asset => asset.id !== imageId);
    this._canvasBackgroundImages.set(next);

    if (match.source === 'upload' && this._uploadedObjectUrls.has(match.url)) {
      URL.revokeObjectURL(match.url);
      this._uploadedObjectUrls.delete(match.url);
    }

    if (this._canvasBackgroundImage() === imageId) {
      const fallback = next[0]?.id ?? DEFAULT_CANVAS_BACKGROUND_IMAGE.id;
      this._canvasBackgroundImage.set(fallback);
    }
  }

  clearCanvasBackgroundImages(): void {
    this._canvasBackgroundImages.set([]);
    this._uploadedObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this._uploadedObjectUrls.clear();

    if (this._canvasBackgroundImage() !== DEFAULT_CANVAS_BACKGROUND_IMAGE.id) {
      this._canvasBackgroundImage.set(DEFAULT_CANVAS_BACKGROUND_IMAGE.id);
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `element_${this._nextId++}`;
  }

  // Create a new UI element with default values
  createUIElement(type: UIElementTypes, name?: string): UIElement {
    const id = this.generateId();
    return {
      id,
      name: name || `${type}_${generateRandomSuffix()}`,
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

  generateExportArtifacts(): UIExportArtifacts {
    const elements = this._elements();
    const params = elements.map(element => this.serializeElement(element));
    const paramsJson = JSON.stringify(params, null, 2);
    const strings = this.collectTextStrings(elements);
    const stringsJson = Object.keys(strings).length ? JSON.stringify(strings, null, 2) : '{}';
    const typescriptCode = this.buildTypescriptCode(params, strings);

    return {
      params,
      paramsJson,
      strings,
      stringsJson,
      typescriptCode,
    };
  }

  // Legacy support for existing callers expecting raw JSON
  exportToJson(): string {
    return this.generateExportArtifacts().paramsJson;
  }

  // Clear all elements
  clear(): void {
    this._elements.set([]);
    this._selectedElementId.set(null);
    this._nextId = 1;
  }

  private computeElementBounds(): UIElementBounds[] {
    const bounds: UIElementBounds[] = [];

    const traverse = (
      elements: UIElement[],
      parentRect: UIRect | null,
      parentId: string | null
    ) => {
      const parentWidth = parentRect ? parentRect.width : CANVAS_WIDTH;
      const parentHeight = parentRect ? parentRect.height : CANVAS_HEIGHT;

      for (const element of elements) {
        const anchorStart = this.getAnchorStartCoordinates(element.anchor, parentWidth, parentHeight);
        const anchorOffset = this.getAnchorOffset(element.anchor, element.size);
        const baseX = parentRect ? parentRect.left : 0;
        const baseY = parentRect ? parentRect.top : 0;
        const absoluteX = baseX + anchorStart.x + anchorOffset.x + element.position[0];
        const absoluteY = baseY + anchorStart.y + anchorOffset.y + element.position[1];
        const width = element.size[0];
        const height = element.size[1];

        const rect: UIRect = {
          left: absoluteX,
          top: absoluteY,
          right: absoluteX + width,
          bottom: absoluteY + height,
          width,
          height,
          centerX: absoluteX + width / 2,
          centerY: absoluteY + height / 2,
        };

        bounds.push({
          id: element.id,
          parentId,
          rect,
        });

        if (element.children?.length) {
          traverse(element.children, rect, element.id);
        }
      }
    };

    traverse(this._elements(), null, null);

    return bounds;
  }

  private getAnchorStartCoordinates(anchor: UIAnchor, parentWidth: number, parentHeight: number): { x: number; y: number } {
    switch (anchor) {
      case UIAnchor.TopLeft:
        return { x: 0, y: 0 };
      case UIAnchor.TopCenter:
        return { x: parentWidth / 2, y: 0 };
      case UIAnchor.TopRight:
        return { x: parentWidth, y: 0 };
      case UIAnchor.CenterLeft:
        return { x: 0, y: parentHeight / 2 };
      case UIAnchor.Center:
        return { x: parentWidth / 2, y: parentHeight / 2 };
      case UIAnchor.CenterRight:
        return { x: parentWidth, y: parentHeight / 2 };
      case UIAnchor.BottomLeft:
        return { x: 0, y: parentHeight };
      case UIAnchor.BottomCenter:
        return { x: parentWidth / 2, y: parentHeight };
      case UIAnchor.BottomRight:
        return { x: parentWidth, y: parentHeight };
      default:
        return { x: 0, y: 0 };
    }
  }

  private getAnchorOffset(anchor: UIAnchor, size: number[]): { x: number; y: number } {
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

  private serializeElement(element: UIElement): UIParams {
    const { id, children = [], ...rest } = element;
    const serializedChildren = children.map(child => this.serializeElement(child));

    return {
      ...(rest as UIParams),
      children: serializedChildren,
    };
  }

  private collectTextStrings(elements: UIElement[]): Record<string, string> {
    const strings: Record<string, string> = {};

    const traverse = (nodes: UIElement[]) => {
      for (const node of nodes) {
        if (node.type === 'Text') {
          const text = (node.textLabel ?? '').trim();
          if (text.length > 0) {
            const key = node.name || node.id;
            if (!(key in strings)) {
              strings[key] = text;
            }
          }
        }

        if (node.children?.length) {
          traverse(node.children);
        }
      }
    };

    traverse(elements);

    return strings;
  }

  private buildTypescriptCode(params: UIParams[], strings: Record<string, string>): string {
    const codeLines: string[] = [
      `// Auto-generated UI script ${new Date().toLocaleString()}`,
      'const widget = modlib.ParseUI(',
    ];

    if (params.length) {
      params.forEach((param, index) => {
        const isLast = index === params.length - 1;
        const serialized = this.serializeParamToTypescript(param, 1, strings);
        if (isLast) {
          codeLines.push(serialized);
        } else {
          const lines = serialized.split('\n');
          lines[lines.length - 1] = `${lines[lines.length - 1]},`;
          codeLines.push(lines.join('\n'));
          codeLines.push('');
        }
      });
    } else {
      codeLines.push('  // No UI elements defined');
    }

    codeLines.push(');');
    codeLines.push('');

    return codeLines.join('\n');
  }

  private serializeParamToTypescript(param: UIParams, indentLevel = 0, strings: Record<string, string>): string {
    const indent = '  '.repeat(indentLevel);
    const propIndent = '  '.repeat(indentLevel + 1);
    const children = param.children ?? [];

    const propertyBlocks: string[][] = [];
    const pushLine = (line: string) => propertyBlocks.push([line]);

    pushLine(`${propIndent}type: ${this.formatString(param.type)}`);
    pushLine(`${propIndent}name: ${this.formatString(param.name)}`);
    pushLine(`${propIndent}position: ${this.formatNumberArray(param.position)}`);
    pushLine(`${propIndent}size: ${this.formatNumberArray(param.size)}`);
    pushLine(`${propIndent}anchor: ${this.formatEnumValue('UIAnchor', UIAnchor, param.anchor)}`);
    pushLine(`${propIndent}visible: ${this.formatBoolean(param.visible)}`);
    pushLine(`${propIndent}textLabel: ${this.formatTextLabel(param, strings)}`);
    pushLine(`${propIndent}textColor: ${this.formatNumberArray(param.textColor)}`);
    pushLine(`${propIndent}textAlpha: ${this.formatNumber(param.textAlpha)}`);
    pushLine(`${propIndent}textSize: ${this.formatNumber(param.textSize)}`);
    pushLine(`${propIndent}textAnchor: ${this.formatEnumValue('UIAnchor', UIAnchor, param.textAnchor)}`);
    pushLine(`${propIndent}padding: ${this.formatNumber(param.padding)}`);
    pushLine(`${propIndent}bgColor: ${this.formatNumberArray(param.bgColor)}`);
    pushLine(`${propIndent}bgAlpha: ${this.formatNumber(param.bgAlpha)}`);
    pushLine(`${propIndent}bgFill: ${this.formatEnumValue('UIBgFill', UIBgFill, param.bgFill)}`);
    pushLine(`${propIndent}imageType: ${this.formatEnumValue('UIImageType', UIImageType, param.imageType)}`);
    pushLine(`${propIndent}imageColor: ${this.formatNumberArray(param.imageColor)}`);
    pushLine(`${propIndent}imageAlpha: ${this.formatNumber(param.imageAlpha)}`);
    pushLine(`${propIndent}buttonEnabled: ${this.formatBoolean(param.buttonEnabled)}`);

    if (param.buttonEnabled) {
      pushLine(`${propIndent}buttonColorBase: ${this.formatNumberArray(param.buttonColorBase)}`);
      pushLine(`${propIndent}buttonAlphaBase: ${this.formatNumber(param.buttonAlphaBase)}`);
      pushLine(`${propIndent}buttonColorDisabled: ${this.formatNumberArray(param.buttonColorDisabled)}`);
      pushLine(`${propIndent}buttonAlphaDisabled: ${this.formatNumber(param.buttonAlphaDisabled)}`);
      pushLine(`${propIndent}buttonColorPressed: ${this.formatNumberArray(param.buttonColorPressed)}`);
      pushLine(`${propIndent}buttonAlphaPressed: ${this.formatNumber(param.buttonAlphaPressed)}`);
      pushLine(`${propIndent}buttonColorHover: ${this.formatNumberArray(param.buttonColorHover)}`);
      pushLine(`${propIndent}buttonAlphaHover: ${this.formatNumber(param.buttonAlphaHover)}`);
      pushLine(`${propIndent}buttonColorFocused: ${this.formatNumberArray(param.buttonColorFocused)}`);
      pushLine(`${propIndent}buttonAlphaFocused: ${this.formatNumber(param.buttonAlphaFocused)}`);
    }

    if (children.length) {
      const childBlock: string[] = [`${propIndent}children: [`];
      children.forEach((child, index) => {
        let childString = this.serializeParamToTypescript(child, indentLevel + 2, strings);
        const childLines = childString.split('\n');
        if (index < children.length - 1) {
          childLines[childLines.length - 1] = `${childLines[childLines.length - 1]},`;
        }
        childBlock.push(...childLines);
      });
      childBlock.push(`${propIndent}]`);
      propertyBlocks.push(childBlock);
    }

    const lines: string[] = [`${indent}{`];
    propertyBlocks.forEach((block, index) => {
      const blockLines = [...block];
      if (index < propertyBlocks.length - 1) {
        const lastLineIndex = blockLines.length - 1;
        blockLines[lastLineIndex] = `${blockLines[lastLineIndex]},`;
      }
      lines.push(...blockLines);
    });
    lines.push(`${indent}}`);

    return lines.join('\n');
  }

  private formatString(value: string | null | undefined): string {
    return JSON.stringify(value ?? '');
  }

  private formatBoolean(value: boolean): string {
    return value ? 'true' : 'false';
  }

  private formatNumberArray(values: number[] | null | undefined): string {
    if (!Array.isArray(values) || values.length === 0) {
      return '[]';
    }
    return `[${values.map(v => this.formatNumber(v)).join(', ')}]`;
  }

  private formatNumber(value: number | null | undefined): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (Number.isInteger(value)) {
        return value.toString();
      }
      const trimmed = Number(value.toFixed(4));
      return trimmed.toString();
    }
    return '0';
  }

  private formatEnumValue(enumName: string, enumRef: any, value: number): string {
    const enumKey = enumRef[value];
    if (typeof enumKey === 'string') {
      return `mod.${enumName}.${enumKey}`;
    }
    return value.toString();
  }

  private formatTextLabel(param: UIParams, strings: Record<string, string>): string {
    const key = this.getLocalizationKey(param, strings);
    if (key) {
      return `mod.stringkeys.${key}`;
    }
    return this.formatString(param.textLabel ?? '');
  }

  private getLocalizationKey(param: UIParams, strings: Record<string, string>): string | null {
    const candidate = param.name?.trim();
    if (candidate && Object.prototype.hasOwnProperty.call(strings, candidate)) {
      return candidate;
    }
    return null;
  }
}