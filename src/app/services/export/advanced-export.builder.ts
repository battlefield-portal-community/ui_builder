import { UIElement, UIAdvancedPresetDefinition, UIParams } from '../../../models/types';

/**
 * Metadata about a TypeScript snippet for an element.
 * Used to track which elements have been exported and their variable names.
 */
export interface BuilderSnippet {
  /** The unique ID of the UI element */
  elementId: string;
  /** Optional variable name assigned to this element in the generated code */
  variableName?: string;
}

/**
 * Loads a template file from the templates directory.
 * 
 * Template files are copied as assets during build and can be loaded at runtime.
 * They use placeholder syntax like {{CLASS_NAME}} which can be replaced using
 * the replacePlaceholders function.
 * 
 * @param templateName - Name of the template file (e.g., 'counter.widget.template.ts')
 * @returns Promise that resolves to the template content as a string
 * 
 * @example
 * ```typescript
 * const template = await loadTemplate('counter.widget.template.ts');
 * const code = replacePlaceholders(template, {
 *   CLASS_NAME: 'MyCounterWidget',
 *   TIMESTAMP: new Date().toISOString()
 * });
 * ```
 */
export async function loadTemplate(templateName: string): Promise<string> {
  const response = await fetch(`templates/${templateName}`);
  if (!response.ok) {
    throw new Error(`Failed to load template: ${templateName}`);
  }
  return response.text();
}

/**
 * Replaces placeholders in a template string.
 * 
 * Placeholders use double curly brace syntax: {{PLACEHOLDER_NAME}}
 * 
 * @param template - The template string with placeholders
 * @param replacements - Object mapping placeholder names to their replacement values
 * @returns Template string with all placeholders replaced
 * 
 * @example
 * ```typescript
 * const result = replacePlaceholders(
 *   'export class {{CLASS_NAME}} { }',
 *   { CLASS_NAME: 'MyWidget' }
 * );
 * // Returns: 'export class MyWidget { }'
 * ```
 */
export function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Interface for advanced preset export generators.
 * Each preset can implement this to define how it exports TypeScript class code.
 * 
 * Advanced presets are complex UI widgets that encapsulate multiple elements and expose
 * custom methods for interaction. This interface allows each preset to define its own
 * export logic for generating TypeScript classes with widget-specific functionality.
 * 
 * @example
 * ```typescript
 * class CounterExportGenerator implements IAdvancedExportGenerator {
 *   generateClassCode(rootElement, preset, className, serializeHelpers, strings, timestamp) {
 *     // Generate TypeScript class with create() and update() methods
 *     return `export class ${className} { ... }`;
 *   }
 * }
 * ```
 */
export interface IAdvancedExportGenerator {
  /**
   * Generate TypeScript class code for an advanced preset instance.
   * 
   * This method is called during export to produce a complete TypeScript class
   * that wraps the UI widget and provides custom functionality. The generated
   * class typically includes:
   * - Properties to store widget references
   * - A create() method to instantiate the widget using modlib.ParseUI()
   * - Custom methods for interacting with the widget (e.g., update(), setValue())
   * 
   * Can be synchronous or asynchronous to support template loading from files.
   * 
   * @param rootElement - The root UIElement of the advanced preset instance
   * @param preset - The preset definition containing metadata and configuration
   * @param className - The unique class name to use for this instance (auto-generated, collision-free)
   * @param serializeHelpers - Helper functions for serialization
   * @param serializeHelpers.serializeParamToTypescript - Converts UIParams to TypeScript object literal
   * @param serializeHelpers.serializeElement - Extracts UIParams from a UIElement
   * @param strings - The localization strings map for text elements
   * @param timestamp - ISO timestamp string for comment headers
   * @returns TypeScript class code as a string (or Promise<string> for async generators)
   */
  generateClassCode(
    rootElement: UIElement,
    preset: UIAdvancedPresetDefinition,
    className: string,
    serializeHelpers: {
      serializeParamToTypescript: (param: UIParams, indentLevel: number, strings: Record<string, string>) => string;
      serializeElement: (e: UIElement) => UIParams;
    },
    strings: Record<string, string>,
    timestamp: string
  ): string | Promise<string>;
}

/**
 * Builds a PascalCase class name from a human-readable label.
 * Ensures the class name ends with "Widget" suffix.
 * 
 * @param label - Human-readable label (e.g., "Counter Container", "my-widget")
 * @returns PascalCase class name ending with "Widget" (e.g., "CounterContainerWidget", "MyWidgetWidget")
 * 
 * @example
 * ```typescript
 * buildClassNameFromLabel("Counter Container") // "CounterContainerWidget"
 * buildClassNameFromLabel("my-button")         // "MyButtonWidget"
 * buildClassNameFromLabel("CustomWidget")      // "CustomWidget"
 * ```
 */
function buildClassNameFromLabel(label: string) {
  const normalized = label.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const parts = normalized ? normalized.split(/\s+/) : ['Advanced'];
  const joined = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  const base = joined.length ? joined : 'Advanced';
  return base.endsWith('Widget') ? base : `${base}Widget`;
}

/**
 * Builds TypeScript class definitions for all advanced preset instances in the UI tree.
 * 
 * This function processes all UI elements marked as advanced preset roots and generates
 * TypeScript classes for them. Each class wraps a widget instance and provides custom
 * methods for interacting with it. The generation process:
 * 
 * 1. Filters elements to find advanced preset roots
 * 2. For each root, generates a unique class name
 * 3. Delegates to the preset's export generator (if available)
 * 4. Falls back to a placeholder class if no generator is defined
 * 
 * Supports both synchronous and asynchronous export generators to allow template loading.
 * 
 * @param elements - All UI elements in the canvas
 * @param presets - All registered advanced preset definitions
 * @param snippets - Metadata about exported elements (currently unused but reserved for future use)
 * @param serializeParamToTypescript - Function to convert UIParams to TypeScript object literal code
 * @param serializeElement - Function to extract UIParams from a UIElement
 * @param strings - Localization strings map for text elements
 * @param timestamp - ISO timestamp string for comment headers
 * @returns Promise resolving to array of class metadata objects containing rootElementId, presetId, className, and generated code
 * 
 * @example
 * ```typescript
 * const classes = await buildAdvancedExportClasses(
 *   elements,
 *   presets,
 *   snippets,
 *   serializeParamToTypescript,
 *   serializeElement,
 *   { "key1": "value1" },
 *   "2025-10-22 14:30:00"
 * );
 * // Returns: [{ rootElementId: "elem123", presetId: "counter", className: "CounterWidget", code: "export class..." }]
 * ```
 */
export async function buildAdvancedExportClasses(
  elements: UIElement[],
  presets: UIAdvancedPresetDefinition[],
  snippets: BuilderSnippet[],
  serializeParamToTypescript: (param: UIParams, indentLevel: number, strings: Record<string, string>) => string,
  serializeElement: (e: UIElement) => UIParams,
  strings: Record<string, string>,
  timestamp: string
): Promise<Array<{ rootElementId: string; presetId: string; className: string; code: string }>> {
  // Find all elements that are roots of advanced presets
  const roots = elements.filter(e => e.advancedMetadata?.isRoot);
  if (!roots.length) return [];

  // Track used class names to prevent collisions
  const used = new Set<string>();

  // Process each root element, awaiting any async generators
  const results = await Promise.all(roots.map(async root => {
    const meta = root.advancedMetadata!;
    const preset = presets.find(p => p.id === meta.presetId) ?? null;
    
    // Generate a unique class name based on preset metadata
    const className = buildClassNameFromLabel(preset?.defaultClassName ?? preset?.label ?? root.name ?? root.id);
    let candidate = className;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${className}${suffix++}`;
    used.add(candidate);

    // Delegate to preset's export generator if available (interface-based approach)
    if (preset?.exportGenerator) {
      const codeOrPromise = preset.exportGenerator.generateClassCode(
        root,
        preset,
        candidate,
        { serializeParamToTypescript, serializeElement },
        strings,
        timestamp
      );
      // Await if it's a Promise, otherwise use directly
      const code = await Promise.resolve(codeOrPromise);
      return {
        rootElementId: root.id,
        presetId: meta.presetId,
        className: candidate,
        code,
      };
    }

    // Fallback placeholder for presets without generators
    const fallbackLines: string[] = [];
    fallbackLines.push(`// Placeholder advanced widget ${timestamp}`);
    fallbackLines.push(`export class ${candidate} {`);
    fallbackLines.push('  constructor(public readonly rootWidget: any) {}');
    fallbackLines.push('}');

    return {
      rootElementId: root.id,
      presetId: meta.presetId,
      className: candidate,
      code: fallbackLines.join('\n'),
    };
  }));

  return results;
}

/**
 * Combines all advanced preset class definitions into a single TypeScript code string.
 * 
 * Takes an array of class metadata objects and joins their code into a single
 * exportable TypeScript module. Classes are separated by blank lines for readability.
 * 
 * @param classes - Array of class metadata objects from buildAdvancedExportClasses
 * @returns Combined TypeScript code string ready for export, or a comment if no classes
 * 
 * @example
 * ```typescript
 * const code = buildAdvancedTypescriptCode([
 *   { rootElementId: "1", presetId: "counter", className: "CounterWidget", code: "export class CounterWidget {...}" }
 * ]);
 * // Returns: "export class CounterWidget {...}\n"
 * ```
 */
export function buildAdvancedTypescriptCode(classes: Array<{ rootElementId: string; presetId: string; className: string; code: string }>): string {
  if (!classes.length) return '// No advanced widgets enabled\n';
  return classes.map(c => c.code.trimEnd()).join('\n\n') + '\n';
}
