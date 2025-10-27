import { UiBuilderService } from '../services/ui-builder.service';
import { counterPreset, COUNTER_PRESET_ID } from './counter.preset';
import { TAB_MENU_ID, tabMenuPreset } from './tab-menu.preset';

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
 */
export function registerAllAdvancedPresets(service: UiBuilderService) {
  // Register built-in presets
  service.registerAdvancedPreset(counterPreset as any);
  service.registerAdvancedPreset(tabMenuPreset as any);
}

/**
 * Returns an array of all built-in advanced preset IDs.
 * 
 * This function provides a centralized list of all preset IDs for validation,
 * filtering, and management purposes. Update this list whenever adding or
 * removing built-in presets.
 * 
 * @returns Array of preset ID strings
 */
export function getBuiltInPresetIds(): string[] {
  return [COUNTER_PRESET_ID, TAB_MENU_ID];
}
