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
  UIAdvancedPresetDefinition,
  UIAdvancedPresetSlotDefinition,
  UIAdvancedElementInstance,
  UIAdvancedSlotBindingMap,
  UIAdvancedSlotBindingValue,
  UIAdvancedSlotMultiplicity,
} from '../../models/types';
import { registerAllAdvancedPresets } from '../advanced-presets/registry';
import { buildAdvancedExportClasses as builder_buildAdvancedExportClasses, buildAdvancedTypescriptCode as builder_buildAdvancedTypescriptCode } from './export/advanced-export.builder';
import { TAB_MENU_ID } from '../advanced-presets/tab-menu.preset';

const DEFAULT_CANVAS_BACKGROUND_IMAGE: CanvasBackgroundAsset = {
  id: 'default-grid',
  label: 'Game 1',
  fileName: 'ingame.jpg',
  url: 'assets/bg_canvas/ingame.jpg',
  source: 'default',
};

const defaultBackgroundMode: CanvasBackgroundMode = 'image';

const AUTOSAVE_COOKIE_NAME = 'bf_ui_builder_autosave';
const AUTOSAVE_INTERVAL_MS = 30000;
const AUTOSAVE_COOKIE_MAX_AGE_DAYS = 7;

interface UIPersistedPayload {
  version: number;
  savedAt: string;
  paramsJson: string;
  stringsJson: string;
  backgroundMode: CanvasBackgroundMode;
  backgroundImage: string | null;
  elementsJson?: string;
}

type ParseUiTokenType =
  | 'braceOpen'
  | 'braceClose'
  | 'bracketOpen'
  | 'bracketClose'
  | 'colon'
  | 'comma'
  | 'string'
  | 'number'
  | 'identifier';

interface ParseUiToken {
  type: ParseUiTokenType;
  value?: string | number | boolean | null;
  raw?: string;
  position: number;
}

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
  typescriptSnippets: UIExportSnippet[];
  advancedClasses: UIAdvancedExportClass[];
  advancedTypescriptCode: string;
}

export interface UIExportSnippet {
  elementId: string;
  name: string;
  variableName: string;
  code: string;
}

export interface UIAdvancedExportClass {
  rootElementId: string;
  presetId: string;
  className: string;
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class UiBuilderService {
  private _elements = signal<UIElement[]>([]);
  private _selectedElementId = signal<string | null>(null);
  private _nextId = 1;
  private _autoSaveIntervalId: number | null = null;
  private _lastSavedSignature: string | null = null;

  private _canvasBackgroundMode = signal<CanvasBackgroundMode>(defaultBackgroundMode);
  private _canvasBackgroundImage = signal<string | null>(DEFAULT_CANVAS_BACKGROUND_IMAGE.id);
  private _canvasBackgroundImages = signal<CanvasBackgroundAsset[]>([]);
  private _uploadedObjectUrls = new Set<string>();
  private _snapToElements = signal<boolean>(true);
  private _showContainerLabels = signal<boolean>(true);
  private _advancedPresets = signal<UIAdvancedPresetDefinition[]>([]);
  private _copiedElement: {
    snapshot: UIElement;
    parentId: string | null;
    index: number;
    sourceId: string;
  } | null = null;

  // Public readonly signals
  readonly elements = this._elements.asReadonly();
  readonly selectedElementId = this._selectedElementId.asReadonly();
  readonly canvasBackgroundMode = this._canvasBackgroundMode.asReadonly();
  readonly canvasBackgroundImage = this._canvasBackgroundImage.asReadonly();
  readonly canvasBackgroundImages = this._canvasBackgroundImages.asReadonly();
  readonly defaultCanvasBackgroundImageId = DEFAULT_CANVAS_BACKGROUND_IMAGE.id;
  readonly defaultCanvasBackgroundImage = DEFAULT_CANVAS_BACKGROUND_IMAGE;
  readonly snapToElements = this._snapToElements.asReadonly();
  readonly showContainerLabels = this._showContainerLabels.asReadonly();
  readonly advancedPresets = this._advancedPresets.asReadonly();
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

  constructor() {
    registerAllAdvancedPresets(this);
    this.restoreProjectFromCookie();
    this.startAutoSaveTimer();
  }

  setSnapToElements(enabled: boolean): void {
    this._snapToElements.set(!!enabled);
  }

  toggleSnapToElements(): void {
    this._snapToElements.update(value => !value);
  }

  setShowContainerLabels(enabled: boolean): void {
    this._showContainerLabels.set(!!enabled);
  }

  toggleShowContainerLabels(): void {
    this._showContainerLabels.update(value => !value);
  }

  registerAdvancedPreset(preset: UIAdvancedPresetDefinition): void {
    const normalized = this.normalizeAdvancedPresetDefinition(preset);
    if (!normalized) {
      return;
    }

    this._advancedPresets.update(current => {
      const withoutDuplicate = current.filter(existing => existing.id !== normalized.id);
      return [...withoutDuplicate, normalized];
    });
  }

  registerAdvancedPresets(presets: UIAdvancedPresetDefinition[]): void {
    presets.forEach(preset => this.registerAdvancedPreset(preset));
  }

  clearAdvancedPresets(): void {
    this._advancedPresets.set([]);
  }

  getAdvancedPreset(presetId: string): UIAdvancedPresetDefinition | null {
    return this.findAdvancedPreset(presetId);
  }

  applyAdvancedPresetToElement(elementId: string, presetId: string, options?: { customOptions?: Record<string, unknown> }): void {
    const preset = this.findAdvancedPreset(presetId);
    if (!preset) {
      return;
    }

    this._elements.update(elements => {
      return this.updateElementRecursive(elements, elementId, (element) => {
        const slotBindings = this.buildSlotBindingSeed(preset);
        const previousMetadata = element.advancedMetadata ?? null;
        return {
          ...element,
          advancedMetadata: {
            presetId: preset.id,
            presetVersion: preset.version,
            isRoot: true,
            slotBindings,
            customOptions: options?.customOptions ?? previousMetadata?.customOptions ?? {},
          },
        };
      });
    });
  }

  removeAdvancedPresetFromElement(elementId: string): void {
    this._elements.update(elements => {
      return this.updateElementRecursive(elements, elementId, (element) => ({
        ...element,
        advancedMetadata: null,
      }));
    });
  }

  instantiateAdvancedPreset(
    presetId: string,
    options?: { name?: string; customOptions?: Record<string, unknown> }
  ): UIElement | null {
    const preset = this.findAdvancedPreset(presetId);
    if (!preset?.blueprint) {
      return null;
    }

    const root = this.buildElementFromParams(preset.blueprint, null);
    return this.applyAdvancedMetadataToPresetTree(root, preset, options);
  }

  addAdvancedPresetRoot(
    presetId: string,
    options?: { name?: string; customOptions?: Record<string, unknown> }
  ): UIElement | null {
    const instance = this.instantiateAdvancedPreset(presetId, options);
    if (!instance) {
      return null;
    }

    this._elements.update(elements => [...elements, instance]);
    this._selectedElementId.set(instance.id);
    return instance;
  }

  isAdvancedRootElement(elementId: string): boolean {
    const element = this.findElementById(elementId);
    return !!element?.advancedMetadata?.isRoot;
  }

  getAdvancedSlotBindings(elementId: string): UIAdvancedSlotBindingMap | null {
    const element = this.findElementById(elementId);
    if (!element?.advancedMetadata?.isRoot) {
      return null;
    }
    return this.cloneSlotBindings(element.advancedMetadata.slotBindings);
  }

  updateAdvancedSlotBinding(rootElementId: string, slotId: string, value: string | string[] | null): void {
    this._elements.update(elements => {
      return this.updateElementRecursive(elements, rootElementId, (element) => {
        if (!element.advancedMetadata?.isRoot) {
          return element;
        }

        const currentBindings = element.advancedMetadata.slotBindings;
        if (!(slotId in currentBindings)) {
          return element;
        }

        const preset = this.findAdvancedPreset(element.advancedMetadata.presetId);
        const slotDefinition = this.findPresetSlotDefinition(preset, slotId);
        const normalizedValue = this.normalizeSlotBindingValue(slotDefinition, value);
        const currentValue = currentBindings[slotId];

        if (!this.slotBindingChanged(currentValue, normalizedValue)) {
          return element;
        }

        const nextBindings = {
          ...this.cloneSlotBindings(currentBindings),
          [slotId]: normalizedValue,
        };

        return {
          ...element,
          advancedMetadata: {
            ...element.advancedMetadata,
            slotBindings: nextBindings,
          },
        };
      });
    });
  }

  private cloneSlotBindings(bindings: UIAdvancedSlotBindingMap | null | undefined): UIAdvancedSlotBindingMap {
    const result: UIAdvancedSlotBindingMap = {};
    if (!bindings) {
      return result;
    }

    for (const [key, value] of Object.entries(bindings)) {
      result[key] = Array.isArray(value) ? [...value] : value;
    }

    return result;
  }

  private findPresetSlotDefinition(
    preset: UIAdvancedPresetDefinition | null | undefined,
    slotId: string
  ): UIAdvancedPresetSlotDefinition | null {
    if (!preset?.slots?.length) {
      return null;
    }

    const trimmedId = slotId?.trim();
    if (!trimmedId) {
      return null;
    }

    return preset.slots.find(slot => slot.id === trimmedId) ?? null;
  }

  private getSlotMultiplicity(slot: UIAdvancedPresetSlotDefinition | null | undefined): UIAdvancedSlotMultiplicity {
    if (slot?.multiplicity === 'list') {
      return 'list';
    }
    return 'single';
  }

  private normalizeSlotBindingValue(
    slot: UIAdvancedPresetSlotDefinition | null,
    value: string | string[] | null
  ): UIAdvancedSlotBindingValue {
    const multiplicity = this.getSlotMultiplicity(slot);

    if (multiplicity === 'single') {
      if (Array.isArray(value)) {
        return value.length ? value[0] ?? null : null;
      }
      return value ?? null;
    }

    const arraySource = Array.isArray(value) ? value : (value ? [value] : []);
    const cleaned = arraySource
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0);
    const unique = Array.from(new Set(cleaned));

    const maxItems = typeof slot?.maxItems === 'number' && slot.maxItems >= 0 ? slot.maxItems : null;
    const limited = maxItems !== null ? unique.slice(0, maxItems) : unique;

    return limited;
  }

  private slotBindingChanged(
    currentValue: UIAdvancedSlotBindingValue,
    nextValue: UIAdvancedSlotBindingValue
  ): boolean {
    const currentIsArray = Array.isArray(currentValue);
    const nextIsArray = Array.isArray(nextValue);

    if (currentIsArray || nextIsArray) {
      if (!currentIsArray || !nextIsArray) {
        return true;
      }

      if (currentValue.length !== nextValue.length) {
        return true;
      }

      for (let index = 0; index < currentValue.length; index++) {
        if (currentValue[index] !== nextValue[index]) {
          return true;
        }
      }

      return false;
    }

    return currentValue !== nextValue;
  }

  private normalizeSlotCount(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }

    const normalized = Math.max(0, Math.floor(value));
    return normalized;
  }

  private decorateAdvancedPresetInstance(
    root: UIElement,
    preset: UIAdvancedPresetDefinition
  ): UIElement {
    if (preset.id === TAB_MENU_ID) {
      return this.decorateTabMenuInstance(root);
    }

    return root;
  }

  private decorateTabMenuInstance(root: UIElement): UIElement {
    if (!root.advancedMetadata) {
      return root;
    }

    const findChildByName = (parent: UIElement | null | undefined, name: string): UIElement | null => {
      if (!parent?.children?.length) {
        return null;
      }
      return parent.children.find(child => child.name === name) ?? null;
    };

  const header = findChildByName(root, 'TabMenuHeader');
    const buttonRow = findChildByName(header, 'TabButtonRow');
    const pagesContainer = findChildByName(root, 'TabPagesContainer');

    if (header) {
      header.locked = true;
    }

    if (buttonRow) {
      buttonRow.locked = true;
    }

    if (pagesContainer) {
      pagesContainer.locked = true;
    }

    const tabButtons = buttonRow?.children?.filter(child => child.type === 'Button') ?? [];
    const tabPages = pagesContainer?.children?.filter(child => child.type === 'Container') ?? [];

    // Ensure page containers remain editable for designers
    tabPages.forEach(page => {
      page.locked = false;
    });

    const buttonIds = tabButtons.map(button => button.id);
    const pageIds = tabPages.map(page => page.id);

    const metadata = root.advancedMetadata;
    const sourceCustomOptions = metadata.customOptions ?? {};
    const defaultIndexSource = sourceCustomOptions['defaultTabIndex'];
    const normalizedDefaultIndex = typeof defaultIndexSource === 'number'
      ? Math.max(0, Math.floor(defaultIndexSource))
      : 0;

    const customOptions = {
      ...sourceCustomOptions,
      tabButtons: buttonIds,
      tabPages: pageIds,
      defaultTabIndex: normalizedDefaultIndex,
    } as Record<string, unknown>;

    metadata.customOptions = customOptions;

    metadata.slotBindings = {
      ...metadata.slotBindings,
      tabContent: [...pageIds],
    };

    return root;
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
      advancedMetadata: null,
      children: [],
    } as UIElement;
  }

  private canElementAcceptChildren(element: UIElement | null | undefined): boolean {
    if (!element) {
      return true;
    }

    return element.type === 'Container';
  }

  // Add element to root or selected element
  addElement(type: UIElementTypes, name?: string): void {
    const selectedId = this._selectedElementId();
    const parent = selectedId ? this.findElementById(selectedId) : null;

    if (selectedId && !parent) {
      this._selectedElementId.set(null);
    }

    if (parent && !this.canElementAcceptChildren(parent)) {
      return;
    }

    const newElement = this.createUIElement(type, name);

    if (parent) {
      this.addElementToParent(newElement, parent.id);
    } else {
      this._elements.update(elements => [...elements, newElement]);
    }

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
      return this.updateElementRecursive(elements, elementId, (element) => {
        const nextUpdates: Partial<UIElement> = { ...updates };

        const requestedLocked =
          Object.prototype.hasOwnProperty.call(nextUpdates, 'locked') && typeof nextUpdates.locked === 'boolean'
            ? nextUpdates.locked
            : element.locked;

        if (element.locked && requestedLocked !== false) {
          delete nextUpdates.position;
          delete nextUpdates.size;
        }

        return {
          ...element,
          ...nextUpdates,
        };
      });
    });
  }

  setElementLocked(elementId: string, locked: boolean): void {
    this.updateElement(elementId, { locked });
  }

  toggleElementLocked(elementId: string): void {
    const element = this.findElementById(elementId);
    if (!element) {
      return;
    }

    this.setElementLocked(elementId, !element.locked);
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

  copyElement(elementId: string): boolean {
    const original = this.findElementById(elementId);
    if (!original) {
      this._copiedElement = null;
      return false;
    }

    const location = this.getElementLocation(elementId);
    if (!location) {
      this._copiedElement = null;
      return false;
    }

    this._copiedElement = {
      snapshot: this.cloneElementSnapshot(original),
      parentId: location.parentId,
      index: location.index,
      sourceId: elementId,
    };

    return true;
  }

  pasteCopiedElement(): UIElement | null {
    if (!this._copiedElement) {
      return null;
    }

    const existingNames = this.collectElementNames();
    const snapshot = this._copiedElement.snapshot;

    const sourceLocation = this.getElementLocation(this._copiedElement.sourceId);
    let parentId = sourceLocation?.parentId ?? this._copiedElement.parentId;
    let insertIndex = sourceLocation?.index ?? this._copiedElement.index;

    if (parentId && !this.findElementById(parentId)) {
      parentId = null;
    }

    const clone = this.cloneElementWithNewIds(snapshot, existingNames);
    const inserted = this.insertCloneAtLocation(clone, parentId, insertIndex + 1);

    if (inserted) {
      const location = this.getElementLocation(inserted.id);
      this._copiedElement = {
        snapshot: this.cloneElementSnapshot(snapshot),
        parentId: location?.parentId ?? parentId,
        index: location?.index ?? insertIndex + 1,
        sourceId: inserted.id,
      };
    }

    return inserted;
  }

  duplicateElement(elementId: string): UIElement | null {
    const original = this.findElementById(elementId);
    if (!original) {
      return null;
    }

    const location = this.getElementLocation(elementId);
    if (!location) {
      return null;
    }

    const existingNames = this.collectElementNames();
    const clone = this.cloneElementWithNewIds(original, existingNames);
    return this.insertCloneAtLocation(clone, location.parentId, location.index + 1);
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

  private collectElementNames(): Set<string> {
    const names = new Set<string>();

    const traverse = (elements: UIElement[]) => {
      for (const element of elements) {
        if (element.name) {
          names.add(element.name);
        }

        if (element.children?.length) {
          traverse(element.children);
        }
      }
    };

    traverse(this._elements());
    return names;
  }

  private cloneElementWithNewIds(element: UIElement, existingNames: Set<string>): UIElement {
    const id = this.generateId();
    const name = this.generateDuplicateName(element.name, existingNames);
    const children = element.children?.map(child => this.cloneElementWithNewIds(child, existingNames)) ?? [];

    return {
      ...element,
      id,
      name,
      position: this.cloneVector(element.position),
      size: this.cloneVector(element.size),
      textColor: this.cloneVector(element.textColor),
      bgColor: this.cloneVector(element.bgColor),
      imageColor: this.cloneVector(element.imageColor),
      buttonColorBase: this.cloneVector(element.buttonColorBase),
      buttonColorDisabled: this.cloneVector(element.buttonColorDisabled),
      buttonColorPressed: this.cloneVector(element.buttonColorPressed),
      buttonColorHover: this.cloneVector(element.buttonColorHover),
      buttonColorFocused: this.cloneVector(element.buttonColorFocused),
      children,
      advancedMetadata: element.advancedMetadata?.isRoot
        ? null
        : this.cloneAdvancedMetadata(element.advancedMetadata),
    };
  }

  private cloneElementSnapshot(element: UIElement): UIElement {
    const children = element.children?.map(child => this.cloneElementSnapshot(child)) ?? [];

    return {
      ...element,
      position: this.cloneVector(element.position),
      size: this.cloneVector(element.size),
      textColor: this.cloneVector(element.textColor),
      bgColor: this.cloneVector(element.bgColor),
      imageColor: this.cloneVector(element.imageColor),
      buttonColorBase: this.cloneVector(element.buttonColorBase),
      buttonColorDisabled: this.cloneVector(element.buttonColorDisabled),
      buttonColorPressed: this.cloneVector(element.buttonColorPressed),
      buttonColorHover: this.cloneVector(element.buttonColorHover),
      buttonColorFocused: this.cloneVector(element.buttonColorFocused),
      children,
      advancedMetadata: this.cloneAdvancedMetadata(element.advancedMetadata),
    };
  }

  private generateDuplicateName(baseName: string | null | undefined, existingNames: Set<string>): string {
    const trimmed = (baseName ?? '').trim();
    const source = trimmed.length > 0 ? trimmed : 'Element';
    let candidate = `${source}_Copy`;
    let suffix = 2;

    while (existingNames.has(candidate)) {
      candidate = `${source}_Copy${suffix++}`;
    }

    existingNames.add(candidate);
    return candidate;
  }

  private cloneVector(values: number[] | null | undefined): number[] {
    return Array.isArray(values) ? [...values] : [];
  }

  private cloneAdvancedMetadata(metadata: UIAdvancedElementInstance | null | undefined): UIAdvancedElementInstance | null {
    if (!metadata) {
      return null;
    }

    return {
      presetId: metadata.presetId,
      presetVersion: metadata.presetVersion,
      isRoot: metadata.isRoot,
      slotBindings: this.cloneSlotBindings(metadata.slotBindings),
      customOptions: metadata.customOptions ? { ...metadata.customOptions } : undefined,
    };
  }

  private normalizeAdvancedPresetDefinition(preset: UIAdvancedPresetDefinition | null | undefined): UIAdvancedPresetDefinition | null {
    if (!preset) {
      return null;
    }

    const trimmedId = typeof preset.id === 'string' ? preset.id.trim() : '';
    if (!trimmedId) {
      return null;
    }

    const normalizedSlots = (preset.slots ?? [])
      .map(slot => {
        const slotId = typeof slot.id === 'string' ? slot.id.trim() : '';
        if (!slotId) {
          return null;
        }

        const multiplicity: UIAdvancedSlotMultiplicity = slot.multiplicity === 'list' ? 'list' : 'single';
        const allowedTypes = slot.allowedTypes ? [...slot.allowedTypes] : undefined;
        const minItems = multiplicity === 'list' ? this.normalizeSlotCount(slot.minItems) : undefined;
        const maxItems = multiplicity === 'list'
          ? slot.maxItems === null
            ? null
            : this.normalizeSlotCount(slot.maxItems)
          : undefined;

        return {
          ...slot,
          id: slotId,
          label: slot.label?.trim() || slotId,
          allowedTypes,
          multiplicity,
          minItems,
          maxItems,
        };
      })
      .filter((slot): slot is NonNullable<typeof slot> => !!slot);

    return {
      ...preset,
      id: trimmedId,
      label: preset.label?.trim() || trimmedId,
      version: preset.version?.trim() || '1.0.0',
      category: preset.category?.trim(),
      defaultClassName: preset.defaultClassName?.trim(),
      defaultRootName: preset.defaultRootName?.trim(),
      slots: normalizedSlots,
    };
  }

  private findAdvancedPreset(presetId: string | null | undefined): UIAdvancedPresetDefinition | null {
    const trimmed = typeof presetId === 'string' ? presetId.trim() : '';
    if (!trimmed) {
      return null;
    }

    return this._advancedPresets().find(option => option.id === trimmed) ?? null;
  }

  private buildSlotBindingSeed(preset: UIAdvancedPresetDefinition): UIAdvancedSlotBindingMap {
    const bindings: UIAdvancedSlotBindingMap = {};
    (preset.slots ?? []).forEach(slot => {
      const slotId = slot.id.trim();
      if (!slotId || slotId in bindings) {
        return;
      }

      const multiplicity = this.getSlotMultiplicity(slot);
      bindings[slotId] = multiplicity === 'list' ? [] : null;
    });
    return bindings;
  }

  private applyAdvancedMetadataToPresetTree(
    element: UIElement,
    preset: UIAdvancedPresetDefinition,
    options?: { name?: string; customOptions?: Record<string, unknown> }
  ): UIElement {
    const assign = (node: UIElement, parentId: string | null, isRoot: boolean): UIElement => {
      const normalizedChildren = (node.children ?? []).map(child => assign(child, node.id, false));

      return {
        ...node,
        parent: parentId,
        name: isRoot && options?.name ? options.name : node.name,
        advancedMetadata: isRoot
          ? {
              presetId: preset.id,
              presetVersion: preset.version,
              isRoot: true,
              slotBindings: this.buildSlotBindingSeed(preset),
              customOptions: options?.customOptions ? { ...options.customOptions } : {},
            }
          : null,
        children: normalizedChildren,
      };
    };

    const withMetadata = assign(element, null, true);
    return this.decorateAdvancedPresetInstance(withMetadata, preset);
  }

  private insertCloneAtLocation(clone: UIElement, parentId: string | null, insertIndex: number): UIElement | null {
    const parentExists = parentId ? this.findElementById(parentId) : null;

    this._elements.update(elements => {
      if (!parentId || !parentExists) {
        const next = [...elements];
        const clamped = this.clampIndex(insertIndex, next.length);
        next.splice(clamped, 0, clone);
        return next;
      }

      return this.updateElementRecursive(elements, parentId, (parent) => {
        const currentChildren = parent.children ? [...parent.children] : [];
        const clamped = this.clampIndex(insertIndex, currentChildren.length);
        const nextChildren = [...currentChildren];
        nextChildren.splice(clamped, 0, clone);
        return {
          ...parent,
          children: nextChildren,
        };
      });
    });

    this._selectedElementId.set(clone.id);
    return clone;
  }

  private clampIndex(index: number, length: number): number {
    if (!Number.isFinite(index)) {
      return length;
    }
    return Math.min(Math.max(index, 0), length);
  }

  async generateExportArtifacts(): Promise<UIExportArtifacts> {
    const elements = this._elements();
    const params = elements.map(element => this.serializeElement(element));
    const paramsJson = JSON.stringify(params, null, 2);
    const strings = this.collectTextStrings(elements);
    const stringsJson = Object.keys(strings).length ? JSON.stringify(strings, null, 2) : '{}';
    const timestamp = new Date().toLocaleString();
    const typescriptSnippets = this.buildTypescriptSnippets(elements, params, strings, timestamp);
    const typescriptCode = this.buildTypescriptCode(typescriptSnippets, timestamp);
  const presets = this._advancedPresets();
  const snippetList = typescriptSnippets.map(s => ({ elementId: s.elementId, variableName: s.variableName }));
  const advancedClasses = await builder_buildAdvancedExportClasses(
      elements,
      presets,
      snippetList,
      this.serializeParamToTypescript.bind(this),
      this.serializeElement.bind(this),
      strings,
      timestamp);

  const advancedTypescriptCode = builder_buildAdvancedTypescriptCode(advancedClasses);

    return {
      params,
      paramsJson,
      strings,
      stringsJson,
      typescriptCode,
      typescriptSnippets,
      advancedClasses,
      advancedTypescriptCode,
    };
  }

  // Legacy support for existing callers expecting raw JSON
  async exportToJson(): Promise<string> {
    return (await this.generateExportArtifacts()).paramsJson;
  }

  importFromTypescript(
    source: string,
    options?: { mode?: 'replace' | 'append' }
  ): { success: boolean; importedCount: number; error?: string } {
    const text = typeof source === 'string' ? source : '';
    if (!text.trim()) {
      return { success: false, importedCount: 0, error: 'No TypeScript content provided.' };
    }

    try {
      const params = this.parseParseUiTypescript(text);

      const mode = options?.mode === 'append' ? 'append' : 'replace';

      if (mode === 'replace') {
        this.clear();
        this._copiedElement = null;
      }

      this._lastSavedSignature = null;

      if (!params.length) {
        return { success: true, importedCount: 0 };
      }

      const restored = this.restoreElementsFromParams(params);

      if (mode === 'append') {
        this._elements.set([...this._elements(), ...restored]);
      } else {
        this._elements.set(restored);
      }

      this._selectedElementId.set(null);

      return { success: true, importedCount: restored.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import UI script.';
      return { success: false, importedCount: 0, error: message };
    }
  }

  // Clear all elements
  clear(): void {
    this._elements.set([]);
    this._selectedElementId.set(null);
    this._nextId = 1;
  }

  private startAutoSaveTimer(): void {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    if (this._autoSaveIntervalId !== null) {
      window.clearInterval(this._autoSaveIntervalId);
    }

    this.saveProjectToCookie();
    this._autoSaveIntervalId = window.setInterval(() => this.saveProjectToCookie(), AUTOSAVE_INTERVAL_MS);
  }

  private async saveProjectToCookie(): Promise<void> {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    const artifacts = await this.generateExportArtifacts();
    const payload: UIPersistedPayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      paramsJson: artifacts.paramsJson,
      stringsJson: artifacts.stringsJson,
      backgroundMode: this._canvasBackgroundMode(),
      backgroundImage: this._canvasBackgroundImage(),
      elementsJson: JSON.stringify(this._elements()),
    };

    const serialized = JSON.stringify(payload);
    if (serialized === this._lastSavedSignature) {
      return;
    }

    if (serialized.length > 3800) {
      console.warn('Auto-save skipped: project export exceeds cookie size limits.');
      return;
    }

    this.setCookie(AUTOSAVE_COOKIE_NAME, serialized, AUTOSAVE_COOKIE_MAX_AGE_DAYS);
    this._lastSavedSignature = serialized;
  }

  private restoreProjectFromCookie(): void {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    const raw = this.getCookie(AUTOSAVE_COOKIE_NAME);
    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as UIPersistedPayload | null;
      if (!payload || typeof payload !== 'object') {
        return;
      }

      let restoredElements: UIElement[] | null = null;

      if (typeof payload.elementsJson === 'string' && payload.elementsJson.trim().length > 0) {
        restoredElements = this.restoreElementsFromElementsJson(payload.elementsJson);
      }

      if (!restoredElements) {
        const params = JSON.parse(payload.paramsJson ?? '[]');
        if (!Array.isArray(params)) {
          return;
        }

        restoredElements = this.restoreElementsFromParams(params as UIParams[]);
      }

      this._elements.set(restoredElements);
      this.refreshNextId(restoredElements);
      this._selectedElementId.set(null);

      if (payload.backgroundMode) {
        this.setCanvasBackgroundMode(payload.backgroundMode);
      }

      if (payload.backgroundImage) {
        this.setCanvasBackgroundImage(payload.backgroundImage);
      }

      this._lastSavedSignature = raw;
    } catch (error) {
      console.error('Failed to restore project from cookie:', error);
    }
  }

  private restoreElementsFromParams(params: UIParams[], parentId: string | null = null): UIElement[] {
    return params.map(param => this.buildElementFromParams(param, parentId));
  }

  private restoreElementsFromElementsJson(elementsJson: string): UIElement[] | null {
    try {
      const parsed = JSON.parse(elementsJson);
      if (!Array.isArray(parsed)) {
        return null;
      }

      const hydrate = (nodes: any[], parentId: string | null): UIElement[] =>
        nodes
          .map(node => {
            if (!node || typeof node !== 'object') {
              return null;
            }

            const children = Array.isArray(node.children) ? hydrate(node.children, node.id ?? null) : [];

            return {
              ...node,
              parent: parentId,
              locked: typeof node.locked === 'boolean' ? node.locked : false,
              advancedMetadata: this.cloneAdvancedMetadata(node.advancedMetadata as UIAdvancedElementInstance | null | undefined),
              children,
            } as UIElement;
          })
          .filter((node): node is UIElement => !!node);

      return hydrate(parsed, null);
    } catch (error) {
      console.error('Failed to restore elements from saved state:', error);
      return null;
    }
  }

  private refreshNextId(elements: UIElement[]): void {
    let maxIdNumeric = 0;

    const visit = (nodes: UIElement[]) => {
      for (const node of nodes) {
        const match = typeof node.id === 'string' ? node.id.match(/_(\d+)$/) : null;
        if (match) {
          const numericId = Number.parseInt(match[1], 10);
          if (Number.isFinite(numericId)) {
            maxIdNumeric = Math.max(maxIdNumeric, numericId);
          }
        }

        if (node.children?.length) {
          visit(node.children);
        }
      }
    };

    visit(elements);

    const nextId = maxIdNumeric + 1;
    this._nextId = Math.max(this._nextId, nextId);
  }

  private buildElementFromParams(param: UIParams, parentId: string | null): UIElement {
    const base = this.createUIElement(param.type, param.name);
    const childParams = Array.isArray(param.children) ? param.children : [];

    const element: UIElement = {
      ...base,
      parent: parentId,
      name: param.name ?? base.name,
      type: param.type ?? base.type,
      position: this.cloneVectorWithFallback(param.position, base.position),
      size: this.cloneVectorWithFallback(param.size, base.size),
      anchor: param.anchor ?? base.anchor,
      visible: typeof param.visible === 'boolean' ? param.visible : base.visible,
      textLabel: param.textLabel ?? base.textLabel,
      textColor: this.cloneVectorWithFallback(param.textColor, base.textColor),
      textAlpha: this.ensureNumber(param.textAlpha, base.textAlpha),
      textSize: this.ensureNumber(param.textSize, base.textSize),
      textAnchor: param.textAnchor ?? base.textAnchor,
      padding: this.ensureNumber(param.padding, base.padding),
      bgColor: this.cloneVectorWithFallback(param.bgColor, base.bgColor),
      bgAlpha: this.ensureNumber(param.bgAlpha, base.bgAlpha),
      bgFill: param.bgFill ?? base.bgFill,
      imageType: param.imageType ?? base.imageType,
      imageColor: this.cloneVectorWithFallback(param.imageColor, base.imageColor),
      imageAlpha: this.ensureNumber(param.imageAlpha, base.imageAlpha),
      buttonEnabled: typeof param.buttonEnabled === 'boolean' ? param.buttonEnabled : base.buttonEnabled,
      buttonColorBase: this.cloneVectorWithFallback(param.buttonColorBase, base.buttonColorBase),
      buttonAlphaBase: this.ensureNumber(param.buttonAlphaBase, base.buttonAlphaBase),
      buttonColorDisabled: this.cloneVectorWithFallback(param.buttonColorDisabled, base.buttonColorDisabled),
      buttonAlphaDisabled: this.ensureNumber(param.buttonAlphaDisabled, base.buttonAlphaDisabled),
      buttonColorPressed: this.cloneVectorWithFallback(param.buttonColorPressed, base.buttonColorPressed),
      buttonAlphaPressed: this.ensureNumber(param.buttonAlphaPressed, base.buttonAlphaPressed),
      buttonColorHover: this.cloneVectorWithFallback(param.buttonColorHover, base.buttonColorHover),
      buttonAlphaHover: this.ensureNumber(param.buttonAlphaHover, base.buttonAlphaHover),
      buttonColorFocused: this.cloneVectorWithFallback(param.buttonColorFocused, base.buttonColorFocused),
      buttonAlphaFocused: this.ensureNumber(param.buttonAlphaFocused, base.buttonAlphaFocused),
      advancedMetadata: this.cloneAdvancedMetadata(param.advancedMetadata),
      children: [],
    };

    element.children = childParams?.length
      ? childParams.map(child => this.buildElementFromParams(child, element.id))
      : [];

    return element;
  }

  private cloneVectorWithFallback(values: number[] | null | undefined, fallback: number[] | null | undefined): number[] {
    if (Array.isArray(values) && values.length) {
      return [...values];
    }

    if (Array.isArray(fallback) && fallback.length) {
      return [...fallback];
    }

    return [];
  }

  private ensureNumber(value: number | null | undefined, fallback: number | null | undefined): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof fallback === 'number' && Number.isFinite(fallback)) {
      return fallback;
    }

    return 0;
  }

  private isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private setCookie(name: string, value: string, maxAgeDays: number): void {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    const expires = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  private getCookie(name: string): string | null {
    if (!this.isBrowserEnvironment()) {
      return null;
    }

    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = cookie.substring(0, separatorIndex);
      if (key === name) {
        return decodeURIComponent(cookie.substring(separatorIndex + 1));
      }
    }

    return null;
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
    const { id, children = [], locked, advancedMetadata, ...rest } = element;
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

  private buildTypescriptCode(snippets: UIExportSnippet[], timestamp?: string): string {
    const codeLines: string[] = snippets.length > 1 ? [`// ${snippets.length} root containers exported`] : [];

    if (!snippets.length) {
      codeLines.push('// No UI elements defined');
      return codeLines.join('\n');
    }

    codeLines.push('');

    snippets.forEach((snippet, index) => {
      const snippetLines = snippet.code.trimEnd();
      codeLines.push(snippetLines);
      if (index < snippets.length - 1) {
        codeLines.push('');
      }
    });

    codeLines.push('');

    return codeLines.join('\n');
  }

  private serializeParamToTypescript(param: UIParams, indentLevel = 0, strings: Record<string, string>): string {
    const indent = '  '.repeat(indentLevel);
    const propIndent = '  '.repeat(indentLevel + 1);
    const children = param.children ?? [];

    const propertyBlocks: string[][] = [];
    const elementType: UIElementTypes = param.type;
    const pushLine = (line: string) => propertyBlocks.push([line]);

    pushLine(`${propIndent}name: ${this.formatString(param.name)}`);
    pushLine(`${propIndent}type: ${this.formatString(param.type)}`);

    pushLine(`${propIndent}position: ${this.formatNumberArray(param.position)}`);
    pushLine(`${propIndent}size: ${this.formatNumberArray(param.size)}`);
    pushLine(`${propIndent}anchor: ${this.formatEnumValue('UIAnchor', UIAnchor, param.anchor)}`);

    pushLine(`${propIndent}visible: ${this.formatBoolean(param.visible)}`);
    pushLine(`${propIndent}padding: ${this.formatNumber(param.padding)}`);

    pushLine(`${propIndent}bgColor: ${this.formatNumberArray(param.bgColor)}`);
    pushLine(`${propIndent}bgAlpha: ${this.formatNumber(param.bgAlpha)}`);
    pushLine(`${propIndent}bgFill: ${this.formatEnumValue('UIBgFill', UIBgFill, param.bgFill)}`);

    if (elementType === "Text") {
      pushLine(`${propIndent}textLabel: ${this.formatTextLabel(param, strings)}`);
      pushLine(`${propIndent}textColor: ${this.formatNumberArray(param.textColor)}`);
      pushLine(`${propIndent}textAlpha: ${this.formatNumber(param.textAlpha)}`);
      pushLine(`${propIndent}textSize: ${this.formatNumber(param.textSize)}`);
      pushLine(`${propIndent}textAnchor: ${this.formatEnumValue('UIAnchor', UIAnchor, param?.textAnchor ?? UIAnchor.TopLeft)}`);
    }

    if (elementType === "Image") {
      pushLine(`${propIndent}imageType: ${this.formatEnumValue('UIImageType', UIImageType, param?.imageType ?? UIImageType.None)}`);
      pushLine(`${propIndent}imageColor: ${this.formatNumberArray(param.imageColor)}`);
      pushLine(`${propIndent}imageAlpha: ${this.formatNumber(param.imageAlpha)}`);
    }

    if (elementType === "Button") {
      pushLine(`${propIndent}buttonEnabled: true`);
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

  private buildTypescriptSnippets(
    elements: UIElement[],
    params: UIParams[],
    strings: Record<string, string>,
    timestamp: string
  ): UIExportSnippet[] {
    if (!elements.length) {
      return [];
    }

    const usedIdentifiers = new Set<string>();

    return elements.map((element, index) => {
      const param = params[index] ?? this.serializeElement(element);
      const resolvedName = (element.name ?? param.name ?? `Element ${index + 1}`).trim() || `Element ${index + 1}`;
      const variableName = this.buildSnippetVariableName(resolvedName, usedIdentifiers);

      const codeLines: string[] = [
        `// Auto-generated UI snippet (${resolvedName}) ${timestamp}`,
        `const ${variableName} = modlib.ParseUI(`,
        this.serializeParamToTypescript(param, 1, strings),
        ');',
        '',
      ];

      return {
        elementId: element.id,
        name: resolvedName,
        variableName,
        code: codeLines.join('\n'),
      };
    });
  }

  private buildSnippetVariableName(label: string, used: Set<string>): string {
    const normalizedLabel = label.replace(/[^A-Za-z0-9]+/g, ' ').trim();
    const parts = normalizedLabel ? normalizedLabel.split(/\s+/) : [];
    const camelCased = parts
      .map(part => part.toLowerCase())
      .map((part, index) => {
        if (index === 0) {
          return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('');

    let base = camelCased || 'widget';
    base = base.replace(/[^A-Za-z0-9_]/g, '');

    if (!/^[A-Za-z_$]/.test(base)) {
      base = `widget${base.charAt(0).toUpperCase()}${base.slice(1)}`;
    }

    const lowerBase = base.toLowerCase();
    if (!lowerBase.endsWith('widget')) {
      base = `${base}Widget`;
    }

    base = base.charAt(0).toLowerCase() + base.slice(1);

    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}${suffix++}`;
    }

    used.add(candidate);
    return candidate;
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
      return `mod.stringkeys.${key.replace(' ', '_')}`;
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

  private parseParseUiTypescript(source: string): UIParams[] {
    const payloads = this.extractParseUiPayloads(source);
    if (!payloads.length) {
      return [];
    }

    const normalized: UIParams[] = [];

    for (const payload of payloads) {
      const tokens = this.tokenizeParseUiPayload(payload);
      if (!tokens.length) {
        continue;
      }

      const rawParams = this.parseTokensToParams(tokens);
      rawParams.forEach(param => normalized.push(this.normalizeParsedParam(param)));
    }

    return normalized;
  }

  private extractParseUiPayloads(source: string): string[] {
    const payloads: string[] = [];
    let searchIndex = 0;

    while (searchIndex < source.length) {
      const result = this.extractNextParseUiPayload(source, searchIndex);
      if (!result) {
        break;
      }

      payloads.push(result.payload);
      searchIndex = result.nextIndex;
    }

    if (!payloads.length) {
      throw new Error('Could not find a modlib.ParseUI call in the provided code.');
    }

    return payloads;
  }

  private extractNextParseUiPayload(
    source: string,
    startSearchIndex: number
  ): { payload: string; nextIndex: number } | null {
    const marker = 'modlib.ParseUI';
    const callIndex = source.indexOf(marker, startSearchIndex);
    if (callIndex === -1) {
      return null;
    }

    const openIndex = source.indexOf('(', callIndex + marker.length);
    if (openIndex === -1) {
      throw new Error('The modlib.ParseUI call is missing its opening parenthesis.');
    }

    const length = source.length;
    let index = openIndex + 1;
    let depth = 1;
    let payload = '';
    let inString = false;
    let stringQuote: string | null = null;
    let escaped = false;

    while (index < length) {
      const char = source[index];
      const nextChar = source[index + 1];

      if (!inString && char === '/') {
        if (nextChar === '/') {
          index += 2;
          while (index < length && source[index] !== '\n' && source[index] !== '\r') {
            index++;
          }
          continue;
        }

        if (nextChar === '*') {
          index += 2;
          while (index < length) {
            if (source[index] === '*' && source[index + 1] === '/') {
              index += 2;
              break;
            }
            index++;
          }
          continue;
        }
      }

      if (!inString && (char === '"' || char === '\'')) {
        inString = true;
        stringQuote = char;
        payload += char;
        index++;
        escaped = false;
        continue;
      }

      if (inString) {
        payload += char;

        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === stringQuote) {
          inString = false;
          stringQuote = null;
        }

        index++;
        continue;
      }

      if (char === '(') {
        depth++;
        payload += char;
        index++;
        continue;
      }

      if (char === ')') {
        depth--;
        if (depth === 0) {
          const closingIndex = index;
          return {
            payload: payload.trim(),
            nextIndex: closingIndex + 1,
          };
        }
        payload += char;
        index++;
        continue;
      }

      payload += char;
      index++;
    }

    throw new Error('The modlib.ParseUI call appears to have unmatched parentheses.');
  }

  private tokenizeParseUiPayload(payload: string): ParseUiToken[] {
    const tokens: ParseUiToken[] = [];
    const length = payload.length;
    let index = 0;

    const isWhitespace = (char: string) => char === ' ' || char === '\n' || char === '\r' || char === '\t';
    const isDigit = (char: string) => char >= '0' && char <= '9';
    const isIdentifierStart = (char: string) => /[A-Za-z_]/.test(char);
    const isIdentifierPart = (char: string) => /[A-Za-z0-9_.]/.test(char);

    const readString = (start: number): { value: string; nextIndex: number } => {
      const quote = payload[start];
      let i = start + 1;
      let result = '';
      let escaped = false;

      while (i < length) {
        const char = payload[i];

        if (escaped) {
          switch (char) {
            case 'n':
              result += '\n';
              break;
            case 'r':
              result += '\r';
              break;
            case 't':
              result += '\t';
              break;
            case '\\':
              result += '\\';
              break;
            case '"':
              result += '"';
              break;
            case '\'':
              result += '\'';
              break;
            default:
              result += char;
          }
          escaped = false;
          i++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          i++;
          continue;
        }

        if (char === quote) {
          return { value: result, nextIndex: i + 1 };
        }

        result += char;
        i++;
      }

      throw new Error(`Unterminated string literal starting at position ${start}.`);
    };

    const readNumber = (start: number): { value: number; nextIndex: number } => {
      let i = start;
      let hasDigit = false;

      if (payload[i] === '-') {
        i++;
      }

      while (i < length && isDigit(payload[i])) {
        i++;
        hasDigit = true;
      }

      if (i < length && payload[i] === '.') {
        i++;
        while (i < length && isDigit(payload[i])) {
          i++;
          hasDigit = true;
        }
      }

      if (!hasDigit) {
        throw new Error(`Invalid number literal at position ${start}.`);
      }

      const rawValue = payload.slice(start, i);
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        throw new Error(`Numeric literal out of range at position ${start}.`);
      }

      return { value: numericValue, nextIndex: i };
    };

    const readIdentifier = (start: number): { value: string; nextIndex: number } => {
      let i = start;
      while (i < length && isIdentifierPart(payload[i])) {
        i++;
      }
      return { value: payload.slice(start, i), nextIndex: i };
    };

    while (index < length) {
      const char = payload[index];

      if (isWhitespace(char)) {
        index++;
        continue;
      }

      const position = index;

      if (char === '{') {
        tokens.push({ type: 'braceOpen', position });
        index++;
        continue;
      }

      if (char === '}') {
        tokens.push({ type: 'braceClose', position });
        index++;
        continue;
      }

      if (char === '[') {
        tokens.push({ type: 'bracketOpen', position });
        index++;
        continue;
      }

      if (char === ']') {
        tokens.push({ type: 'bracketClose', position });
        index++;
        continue;
      }

      if (char === ':') {
        tokens.push({ type: 'colon', position });
        index++;
        continue;
      }

      if (char === ',') {
        tokens.push({ type: 'comma', position });
        index++;
        continue;
      }

      if (char === '"' || char === '\'') {
        const { value, nextIndex } = readString(index);
        tokens.push({ type: 'string', value, raw: payload.slice(index, nextIndex), position });
        index = nextIndex;
        continue;
      }

      if (char === '-' || isDigit(char)) {
        const { value, nextIndex } = readNumber(index);
        tokens.push({ type: 'number', value, raw: payload.slice(index, nextIndex), position });
        index = nextIndex;
        continue;
      }

      if (isIdentifierStart(char)) {
        const { value, nextIndex } = readIdentifier(index);
        tokens.push({ type: 'identifier', value, raw: value, position });
        index = nextIndex;
        continue;
      }

      throw new Error(`Unexpected character '${char}' at position ${position} while parsing modlib.ParseUI payload.`);
    }

    return tokens;
  }

  private parseTokensToParams(tokens: ParseUiToken[]): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    let index = 0;

    const peek = () => tokens[index] ?? null;
    const consume = () => tokens[index++] ?? null;
    const expect = (type: ParseUiTokenType): ParseUiToken => {
      const token = consume();
      if (!token || token.type !== type) {
        throw new Error(`Unexpected token while parsing ParseUI payload. Expected ${type}.`);
      }
      return token;
    };

    const parseValue = (): unknown => {
      const token = peek();
      if (!token) {
        throw new Error('Unexpected end of ParseUI payload.');
      }

      switch (token.type) {
        case 'braceOpen':
          return parseObject();
        case 'bracketOpen':
          return parseArray();
        case 'string':
          consume();
          return token.value ?? '';
        case 'number':
          consume();
          return token.value ?? 0;
        case 'identifier':
          consume();
          return this.resolveIdentifierToken(token.value as string);
        default:
          throw new Error(`Unsupported token type ${token.type} encountered.`);
      }
    };

    const parseObject = (): Record<string, unknown> => {
      expect('braceOpen');
      const result: Record<string, unknown> = {};
      let expectComma = false;

      while (true) {
        const next = peek();
        if (!next) {
          throw new Error('Unterminated object literal in ParseUI payload.');
        }

        if (next.type === 'braceClose') {
          consume();
          break;
        }

        if (expectComma) {
          if (next.type !== 'comma') {
            throw new Error(`Missing comma between object properties in ParseUI payload. ${JSON.stringify(next)}`);
          }
          consume();
        }

        const keyToken = expect('identifier');
        const key = keyToken.value as string;
        expect('colon');
        const value = parseValue();
        result[key] = value;
        expectComma = true;
      }

      return result;
    };

    const parseArray = (): unknown[] => {
      expect('bracketOpen');
      const items: unknown[] = [];
      let expectComma = false;

      while (true) {
        const next = peek();
        if (!next) {
          throw new Error('Unterminated array literal in ParseUI payload.');
        }

        if (next.type === 'bracketClose') {
          consume();
          break;
        }

        if (expectComma) {
          if (next.type !== 'comma') {
            throw new Error(`Missing comma between array items in ParseUI payload. ${JSON.stringify(next)}`);
          }
          consume();
        }

        const value = parseValue();
        items.push(value);
        expectComma = true;
      }

      return items;
    };

    while (index < tokens.length) {
      const value = parseValue();
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('modlib.ParseUI arguments must be object literals.');
      }
      results.push(value as Record<string, unknown>);

      const next = peek();
      if (!next) {
        break;
      }

      if (next.type === 'comma') {
        consume();
        continue;
      }

      throw new Error('Expected a comma between modlib.ParseUI arguments.');
    }

    return results;
  }

  private resolveIdentifierToken(identifier: string): unknown {
    switch (identifier) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'null':
        return null;
      default:
        break;
    }

    if (identifier.startsWith('mod.UIAnchor.')) {
      const key = identifier.substring('mod.UIAnchor.'.length);
      return this.lookupEnumValue('UIAnchor', UIAnchor, key);
    }

    if (identifier.startsWith('mod.UIBgFill.')) {
      const key = identifier.substring('mod.UIBgFill.'.length);
      return this.lookupEnumValue('UIBgFill', UIBgFill, key);
    }

    if (identifier.startsWith('mod.UIImageType.')) {
      const key = identifier.substring('mod.UIImageType.'.length);
      return this.lookupEnumValue('UIImageType', UIImageType, key);
    }

    if (identifier.startsWith('mod.stringkeys.')) {
      return identifier;
    }

    if (identifier === 'undefined') {
      return undefined;
    }

    if (identifier.startsWith('mod.')) {
      throw new Error(`Unsupported identifier '${identifier}' encountered during ParseUI import.`);
    }

    return identifier;
  }

  private lookupEnumValue(enumName: string, enumRef: any, key: string): number {
    if (!key) {
      throw new Error(`Missing ${enumName} member name in ParseUI import.`);
    }

    const value = enumRef[key as keyof typeof enumRef];
    if (typeof value !== 'number') {
      throw new Error(`Unknown ${enumName} member '${key}' in ParseUI import.`);
    }

    return value;
  }

  private normalizeParsedParam(raw: Record<string, unknown>): UIParams {
    const defaults = DEFAULT_UI_PARAMS;
    const node = raw as Record<string, unknown>;
    const childrenInput = Array.isArray(node['children']) ? (node['children'] as unknown[]) : [];
    const buttonEnabled = typeof node['buttonEnabled'] === 'boolean'
      ? (node['buttonEnabled'] as boolean)
      : !!defaults.buttonEnabled;

    const normalized: UIParams = {
      parent: null,
      name: this.ensureString(node['name']),
      type: this.ensureElementType(node['type']),
      position: this.cloneVectorWithFallback(node['position'] as number[] | null | undefined, defaults.position),
      size: this.cloneVectorWithFallback(node['size'] as number[] | null | undefined, defaults.size),
      anchor: this.ensureEnumNumber(node['anchor'], UIAnchor, defaults.anchor ?? UIAnchor.TopLeft),
      visible: typeof node['visible'] === 'boolean' ? (node['visible'] as boolean) : (typeof defaults.visible === 'boolean' ? defaults.visible : true),
      textLabel: typeof node['textLabel'] === 'string' ? (node['textLabel'] as string) : (defaults.textLabel ?? ''),
      textColor: this.cloneVectorWithFallback(node['textColor'] as number[] | null | undefined, defaults.textColor),
      textAlpha: this.ensureNumber(node['textAlpha'] as number | null | undefined, defaults.textAlpha),
      textSize: this.ensureNumber(node['textSize'] as number | null | undefined, defaults.textSize),
      textAnchor: this.ensureEnumNumber(node['textAnchor'], UIAnchor, defaults.textAnchor ?? UIAnchor.Center),
      padding: this.ensureNumber(node['padding'] as number | null | undefined, defaults.padding),
      bgColor: this.cloneVectorWithFallback(node['bgColor'] as number[] | null | undefined, defaults.bgColor),
      bgAlpha: this.ensureNumber(node['bgAlpha'] as number | null | undefined, defaults.bgAlpha),
      bgFill: this.ensureEnumNumber(node['bgFill'], UIBgFill, defaults.bgFill ?? UIBgFill.None),
      imageType: this.ensureEnumNumber(node['imageType'], UIImageType, defaults.imageType ?? UIImageType.None),
      imageColor: this.cloneVectorWithFallback(node['imageColor'] as number[] | null | undefined, defaults.imageColor),
      imageAlpha: this.ensureNumber(node['imageAlpha'] as number | null | undefined, defaults.imageAlpha),
      buttonEnabled,
      buttonColorBase: this.cloneVectorWithFallback(node['buttonColorBase'] as number[] | null | undefined, defaults.buttonColorBase),
      buttonAlphaBase: this.ensureNumber(node['buttonAlphaBase'] as number | null | undefined, defaults.buttonAlphaBase),
      buttonColorDisabled: this.cloneVectorWithFallback(node['buttonColorDisabled'] as number[] | null | undefined, defaults.buttonColorDisabled),
      buttonAlphaDisabled: this.ensureNumber(node['buttonAlphaDisabled'] as number | null | undefined, defaults.buttonAlphaDisabled),
      buttonColorPressed: this.cloneVectorWithFallback(node['buttonColorPressed'] as number[] | null | undefined, defaults.buttonColorPressed),
      buttonAlphaPressed: this.ensureNumber(node['buttonAlphaPressed'] as number | null | undefined, defaults.buttonAlphaPressed),
      buttonColorHover: this.cloneVectorWithFallback(node['buttonColorHover'] as number[] | null | undefined, defaults.buttonColorHover),
      buttonAlphaHover: this.ensureNumber(node['buttonAlphaHover'] as number | null | undefined, defaults.buttonAlphaHover),
      buttonColorFocused: this.cloneVectorWithFallback(node['buttonColorFocused'] as number[] | null | undefined, defaults.buttonColorFocused),
      buttonAlphaFocused: this.ensureNumber(node['buttonAlphaFocused'] as number | null | undefined, defaults.buttonAlphaFocused),
      children: childrenInput.map(child => this.normalizeParsedParam(child as Record<string, unknown>)),
    };

    return normalized;
  }

  private ensureElementType(value: unknown): UIElementTypes {
    if (value === 'Container' || value === 'Text' || value === 'Image' || value === 'Button') {
      return value;
    }
    return 'Container';
  }

  private ensureString(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return 'ImportedElement';
  }

  private ensureEnumNumber(value: unknown, enumRef: any, fallback: number): number {
    if (typeof value === 'number' && enumRef[value] !== undefined) {
      return value;
    }

    if (typeof value === 'string') {
      const mapped = enumRef[value as keyof typeof enumRef];
      if (typeof mapped === 'number') {
        return mapped;
      }
    }

    return fallback;
  }
}