import { UiBuilderService } from '../services/ui-builder.service';
import { counterPreset, COUNTER_PRESET_ID } from './counter.preset';

/**
 * Registers all built-in advanced presets with the UI builder service.
 * 
 * This function is called during service initialization to make all advanced presets
 * available in the UI builder. To add a new advanced preset:
 * 
 * 1. Create a new preset file in this directory (e.g., `my-widget.preset.ts`)
 * 2. Define the preset definition and export generator class
 * 3. Import the preset in this file
 * 4. Call `service.registerAdvancedPreset()` with your preset
 * 5. Add the preset ID to `getBuiltInPresetIds()` array
 * 
 * @param service - The UI builder service instance
 * 
 * @example
 * ```typescript
 * // Adding a new preset:
 * import { myPreset, MY_PRESET_ID } from './my-widget.preset';
 * 
 * export function registerAllAdvancedPresets(service: UiBuilderService) {
 *   service.registerAdvancedPreset(counterPreset as any);
 *   service.registerAdvancedPreset(myPreset as any);  // Add your preset here
 * }
 * 
 * export function getBuiltInPresetIds(): string[] {
 *   return [COUNTER_PRESET_ID, MY_PRESET_ID];  // Add your preset ID here
 * }
 * ```
 */
export function registerAllAdvancedPresets(service: UiBuilderService) {
  // Register built-in presets
  service.registerAdvancedPreset(counterPreset as any);
}

/**
 * Returns an array of all built-in advanced preset IDs.
 * 
 * This function provides a centralized list of all preset IDs for validation,
 * filtering, and management purposes. Update this list whenever adding or
 * removing built-in presets.
 * 
 * @returns Array of preset ID strings
 * 
 * @example
 * ```typescript
 * const builtInIds = getBuiltInPresetIds();
 * // Returns: ['counter-container']
 * 
 * // Check if a preset is built-in:
 * const isBuiltIn = getBuiltInPresetIds().includes(presetId);
 * ```
 */
export function getBuiltInPresetIds(): string[] {
  return [COUNTER_PRESET_ID];
}
