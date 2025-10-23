export enum UIAnchor {
    BottomCenter,
    BottomLeft,
    BottomRight,
    Center,
    CenterLeft,
    CenterRight,
    TopCenter,
    TopLeft,
    TopRight,
}
export enum UIBgFill {
    Blur,
    GradientBottom,
    GradientLeft,
    GradientRight,
    GradientTop,
    None,
    OutlineThick,
    OutlineThin,
    Solid,
}
export enum UIButtonEvent {
    ButtonDown,
    ButtonUp,
    FocusIn,
    FocusOut,
    HoverIn,
    HoverOut,
}
export enum UIDepth {
    AboveGameUI,
    BelowGameUI,
}
export enum UIImageType {
    CrownOutline,
    CrownSolid,
    None,
    QuestionMark,
    RifleAmmo,
    SelfHeal,
    SpawnBeacon,
    TEMP_PortalIcon,
}

export type UIElementTypes = 'Container' | 'Text' | 'Image' | 'Button';

type UIVector = number[];

/**
 * Defines a customizable slot within an advanced preset.
 * 
 * Slots allow presets to have configurable child elements. For example,
 * a counter preset might have a "counterText" slot that allows users to
 * customize which text element displays the counter value.
 * 
 * @property {string} id - Unique identifier for this slot within the preset
 * @property {string} label - Human-readable name displayed in the UI
 * @property {string} [description] - Optional explanation of the slot's purpose
 * @property {boolean} [required] - Whether this slot must be filled (not yet implemented)
 * @property {UIElementTypes[]} [allowedTypes] - Restricts which element types can fill this slot
 * 
 * @example
 * ```typescript
 * const textSlot: UIAdvancedPresetSlotDefinition = {
 *   id: 'counterText',
 *   label: 'Counter Text',
 *   description: 'Text widget displaying the numeric counter.',
 *   allowedTypes: ['Text']
 * };
 * ```
 */
export interface UIAdvancedPresetSlotDefinition {
    id: string;
    label: string;
    description?: string;
    required?: boolean;
    allowedTypes?: UIElementTypes[];
}

/**
 * Defines a reusable advanced preset (complex widget template).
 * 
 * Advanced presets are multi-element widgets with custom functionality that
 * can be instantiated in the UI builder. They combine:
 * - A visual blueprint (UIParams hierarchy)
 * - Metadata for identification and categorization
 * - Slot definitions for customization
 * - An export generator for producing TypeScript classes
 * 
 * The export generator (if provided) implements the IAdvancedExportGenerator interface
 * and defines how the preset exports to TypeScript code with custom methods.
 * 
 * @property {string} id - Unique identifier for this preset (e.g., 'counter-container')
 * @property {string} label - Human-readable name displayed in the UI
 * @property {string} version - Semantic version for tracking preset changes
 * @property {string} [description] - Optional explanation of the preset's functionality
 * @property {string} [category] - Optional category for organizing presets in the UI
 * @property {string} [defaultClassName] - Default TypeScript class name when exported
 * @property {string} [defaultRootName] - Default element name for the root element
 * @property {UIAdvancedPresetSlotDefinition[]} [slots] - Customizable child element slots
 * @property {UIParams} [blueprint] - UI element hierarchy template
 * @property {any} [exportGenerator] - IAdvancedExportGenerator instance for custom export logic
 * 
 * @example
 * ```typescript
 * const counterPreset: UIAdvancedPresetDefinition = {
 *   id: 'counter-container',
 *   label: 'Counter Container',
 *   version: '1.0.0',
 *   description: 'Container with auto-increment counter',
 *   defaultClassName: 'CounterWidget',
 *   blueprint: { ... },
 *   exportGenerator: new CounterExportGenerator()
 * };
 * ```
 * 
 * @see IAdvancedExportGenerator for export generator interface
 * @see UIAdvancedPresetSlotDefinition for slot definitions
 */
export interface UIAdvancedPresetDefinition {
    id: string;
    label: string;
    version: string;
    description?: string;
    category?: string;
    defaultClassName?: string;
    defaultRootName?: string;
    slots?: UIAdvancedPresetSlotDefinition[];
    blueprint?: UIParams;
    exportGenerator?: any; // IAdvancedExportGenerator from advanced-export.builder - avoid circular import
}

/**
 * Metadata attached to UI elements that are part of an advanced preset instance.
 * 
 * When a user instantiates an advanced preset on the canvas, each element in the
 * preset's blueprint receives this metadata. It tracks:
 * - Which preset the element belongs to
 * - Whether this element is the root of the preset instance
 * - How the preset's slots are bound to actual elements
 * - Any custom configuration options
 * 
 * This metadata enables the export system to identify preset instances and generate
 * appropriate TypeScript classes with custom functionality.
 * 
 * @property {string} presetId - ID of the preset this element belongs to
 * @property {string} presetVersion - Version of the preset for compatibility tracking
 * @property {boolean} isRoot - True if this is the root element of the preset instance
 * @property {Record<string, string | null>} slotBindings - Maps slot IDs to element IDs
 * @property {Record<string, unknown>} [customOptions] - Optional preset-specific settings
 * 
 * @example
 * ```typescript
 * const metadata: UIAdvancedElementInstance = {
 *   presetId: 'counter-container',
 *   presetVersion: '1.0.0',
 *   isRoot: true,
 *   slotBindings: { counterText: 'elem_abc123' },
 *   customOptions: { startValue: 0 }
 * };
 * ```
 */
export interface UIAdvancedElementInstance {
    presetId: string;
    presetVersion: string;
    isRoot: boolean;
    slotBindings: Record<string, string | null>;
    customOptions?: Record<string, unknown>;
}

/**
 * Extracts the names of all elements in a UIParams hierarchy recursively.
 * Intended to be used in the script code to be able to retrieve references to all elements by name.
 * @param param root UIParams object
 * @param skipRoot whether to skip the root element's name or not
 * @returns Array of element names
 */
export function getElementNamesRecursive(param: UIParams, skipRoot: boolean = false): string[] {
    const names = skipRoot ? [] : [param.name];
    if (param.children) {
        for (const child of param.children) {
            names.push(...getElementNamesRecursive(child, false));
        }
    }
    return names;
}

export interface UIParams {
    parent?: any;

    name: string;
    type: UIElementTypes;
    position: number[];
    size: number[];
    anchor: UIAnchor;
    visible: boolean;
    textLabel?: string;
    textColor?: UIVector;
    textAlpha?: number;
    textSize?: number;
    textAnchor?: UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: UIBgFill;
    imageType?: UIImageType;
    imageColor?: UIVector;
    imageAlpha?: number;
    children?: UIParams[];
    buttonEnabled?: boolean;
    buttonColorBase?: UIVector;
    buttonAlphaBase?: number;
    buttonColorDisabled?: UIVector;
    buttonAlphaDisabled?: number;
    buttonColorPressed?: UIVector;
    buttonAlphaPressed?: number;
    buttonColorHover?: UIVector;
    buttonAlphaHover?: number;
    buttonColorFocused?: UIVector;
    buttonAlphaFocused?: number;
    advancedMetadata?: UIAdvancedElementInstance | null;
}

// Extended interface for internal use with ID and selection
export interface UIElement extends UIParams {
    id: string;
    locked: boolean;
    children?: UIElement[];
}

// Default values for new elements
export const DEFAULT_UI_PARAMS: Partial<UIElement> = {
    parent: null,

    locked: false,

    position: [0, 0],
    size: [100, 50],
    anchor: UIAnchor.TopLeft,
    visible: true,
    textLabel: '',
    textColor: [1, 1, 1],
    textAlpha: 1,
    textSize: 24,
    textAnchor: UIAnchor.Center,
    padding: 0,
    bgColor: [0.2, 0.2, 0.2],
    bgAlpha: 1,
    bgFill: UIBgFill.None,
    imageType: UIImageType.None,
    imageColor: [1, 1, 1],
    imageAlpha: 1,
    buttonEnabled: false,
    buttonColorBase: [0.3, 0.3, 0.3],
    buttonAlphaBase: 1,
    buttonColorDisabled: [0.1, 0.1, 0.1],
    buttonAlphaDisabled: 0.5,
    buttonColorPressed: [0.2, 0.2, 0.2],
    buttonAlphaPressed: 1,
    buttonColorHover: [0.4, 0.4, 0.4],
    buttonAlphaHover: 1,
    buttonColorFocused: [0.5, 0.5, 0.5],
    buttonAlphaFocused: 1,
    advancedMetadata: null,
};

export type CanvasBackgroundMode = 'black' | 'white' | 'image';

export interface CanvasBackgroundAsset {
    id: string;
    label: string;
    fileName: string;
    url: string;
    source?: 'default' | 'upload' | 'custom';
}

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export interface UIRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

export interface UIElementBounds {
    id: string;
    parentId: string | null;
    rect: UIRect;
}