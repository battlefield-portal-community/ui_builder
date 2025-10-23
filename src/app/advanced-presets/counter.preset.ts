import { getElementNamesRecursive, UIAdvancedPresetDefinition, UIAnchor, UIBgFill, UIElement, UIParams } from '../../models/types';
import { IAdvancedExportGenerator, loadTemplate, replacePlaceholders } from '../services/export/advanced-export.builder';

/**
 * Export generator for the counter preset.
 * 
 * Generates a TypeScript class that wraps a counter widget with automatic increment functionality.
 * This implementation uses a template file (counter.widget.template.ts) for better maintainability.
 * The template approach provides:
 * - Proper TypeScript syntax highlighting and validation in the template file
 * - Easier testing and iteration on the generated code structure
 * - Clear separation between template logic and placeholder replacement
 * - Ability to share common patterns across multiple presets
 * 
 * @implements {IAdvancedExportGenerator}
 * 
 * @example
 * ```typescript
 * // Generated class usage in Battlefield modding:
 * const counter = new CounterWidget();
 * const widget = counter.create();  // Creates the UI widget
 * counter.increment();                 // Increments from 0 to 1
 * counter.decrement();                 // Increments from 1 to 0
 * ```
 */
export class CounterExportGenerator implements IAdvancedExportGenerator {
  private templateCache: string | null = null;

  /**
   * Generates TypeScript class code for a counter widget instance.
   * 
   * Loads the counter widget template and replaces placeholders with actual values:
   * - {{CLASS_NAME}} - Unique class name for this instance
   * - {{TIMESTAMP}} - Generation timestamp
   * - {{UI_PARAMS}} - Serialized UI parameters for modlib.ParseUI()
   * 
   * The template is cached after first load to avoid repeated network requests.
   * 
   * @param rootElement - The root container element of the counter preset
   * @param preset - The counter preset definition
   * @param className - Unique class name for this counter instance
   * @param serializeHelpers - Helper functions for converting UI elements to TypeScript
   * @param serializeHelpers.serializeParamToTypescript - Converts UIParams to object literal code
   * @param serializeHelpers.serializeElement - Extracts UIParams from UIElement
   * @param strings - Localization strings (passed through to serialization)
   * @param timestamp - ISO timestamp for code generation comment header
   * @returns Complete TypeScript class definition as a string
   */
  async generateClassCode(
    rootElement: UIElement,
    preset: UIAdvancedPresetDefinition,
    className: string,
    serializeHelpers: {
      serializeParamToTypescript: (param: UIParams, indentLevel: number, strings: Record<string, string>) => string;
      serializeElement: (e: UIElement) => UIParams;
    },
    strings: Record<string, string>,
    timestamp: string
  ): Promise<string> {
    const { serializeParamToTypescript, serializeElement } = serializeHelpers;
    
    // Load template (cached after first load)
    if (!this.templateCache) {
      this.templateCache = await loadTemplate('counter.widget.template.ts');
    }

    // Serialize the root element into TypeScript object literal format
    const params = serializeElement(rootElement);
    const uiParams = serializeParamToTypescript(params, 3, strings);

    // Replace placeholders in template
    return replacePlaceholders(this.templateCache, {
      CLASS_NAME: className,
      TIMESTAMP: timestamp,
      UI_PARAMS: uiParams
    });
  }
}

/**
 * Unique identifier for the counter preset.
 * Used to register and look up this preset in the preset registry.
 */
export const COUNTER_PRESET_ID = 'counter-container';

/**
 * UI element blueprint for the counter preset.
 * 
 * Defines the visual structure of the counter widget:
 * - A semi-transparent dark container (360x140px)
 * - A centered text element inside for displaying the counter value
 * 
 * This blueprint is instantiated when a user adds a counter preset to the canvas.
 * The actual counter value (0, 1, 2...) is set at runtime via the increment() decrement() methods
 * in the generated TypeScript class.
 */
const blueprint: UIParams = {
    name: "CounterContainer",
    type: "Container",
    position: [49.97, 28.93],
    size: [210, 210],
    anchor: UIAnchor.TopLeft,
    visible: true,
    padding: 0,
    bgColor: [0.2, 0.2, 0.2],
    bgAlpha: 1,
    bgFill: UIBgFill.Blur,
    children: [
      {
        name: "CounterText",
        type: "Text",
        position: [0, 0],
        size: [150, 150],
        anchor: UIAnchor.Center,
        visible: true,
        padding: 0,
        bgColor: [0.2, 0.2, 0.2],
        bgAlpha: 1,
        bgFill: UIBgFill.None,
        textLabel: "0",
        textColor: [1, 1, 1],
        textAlpha: 1,
        textSize: 38,
        textAnchor: UIAnchor.Center
      }
    ]
};

/**
 * Counter preset definition.
 * 
 * Defines a reusable counter widget that can be added to the UI builder canvas.
 * When exported, generates a TypeScript class with:
 * - A create() method that instantiates the widget
 * - A increment() and decrement() method to modify the counter value
 * - Public properties for accessing the container and text widgets
 * 
 * This preset demonstrates the advanced preset system's capabilities:
 * - Complex multi-element widgets
 * - Custom export logic via CounterExportGenerator
 * - Slot definitions for customizable child elements
 * - Integration with the Battlefield modlib.ParseUI() system
 * 
 * @see CounterExportGenerator for the export code generation logic
 * @see UIAdvancedPresetDefinition for the preset type definition
 */
export const counterPreset: UIAdvancedPresetDefinition = {
  id: COUNTER_PRESET_ID,
  label: 'Counter Container',
  version: '1.0.0',
  description: 'Container with a text widget that be incremented or decremented.',
  defaultClassName: 'CounterWidget',
  defaultRootName: 'CounterContainer',
  blueprint,
  slots: [
    {
      id: 'counterText',
      label: 'Counter Text',
      description: 'Text widget displaying the numeric counter.',
      allowedTypes: ['Text'],
    },
  ],
  exportGenerator: new CounterExportGenerator(),
};
