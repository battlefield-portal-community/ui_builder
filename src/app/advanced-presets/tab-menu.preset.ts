import { UIAdvancedPresetDefinition, UIAnchor, UIBgFill, UIParams, UIElement } from '../../models/types';
import { IAdvancedExportGenerator, loadTemplate, replacePlaceholders } from '../services/export/advanced-export.builder';

export class TabMenuExportGenerator implements IAdvancedExportGenerator {
  private templateCache: string | null = null;

  private flattenElements(root: UIElement): UIElement[] {
    const results: UIElement[] = [];

    const visit = (element: UIElement | null | undefined) => {
      if (!element) {
        return;
      }
      results.push(element);
      element.children?.forEach(child => visit(child));
    };

    visit(root);
    return results;
  }

  private resolveElementsById(
    ids: string[] | undefined,
    elementMap: Map<string, UIElement>,
    fallback: UIElement[]
  ): UIElement[] {
    if (Array.isArray(ids) && ids.length) {
      const resolved = ids
        .map(id => elementMap.get(id))
        .filter((element): element is UIElement => !!element);
      if (resolved.length) {
        return resolved;
      }
    }

    return fallback;
  }

  private escapeForSingleQuotedString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

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
    
    if (!this.templateCache) {
      this.templateCache = await loadTemplate('tab-menu.widget.template.ts');
    }

    const flattened = this.flattenElements(rootElement);
    const elementMap = new Map(flattened.map(element => [element.id, element] as const));

    const customOptions = (rootElement.advancedMetadata?.customOptions ?? {}) as Record<string, unknown>;
    const tabButtonIds = Array.isArray(customOptions['tabButtons']) ? (customOptions['tabButtons'] as string[]) : [];
    const tabPageIds = Array.isArray(customOptions['tabPages']) ? (customOptions['tabPages'] as string[]) : [];

    const fallbackButtons = flattened.filter(element => element.type === 'Button' && /^TabButton/i.test(element.name ?? ''));
    const fallbackPages = flattened.filter(element => element.type === 'Container' && /^TabPage/i.test(element.name ?? ''));

    const tabButtons = this.resolveElementsById(tabButtonIds, elementMap, fallbackButtons);
    const tabPages = this.resolveElementsById(tabPageIds, elementMap, fallbackPages);

    const tabButtonNames = tabButtons
      .map(button => button.name)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
    const tabPageNames = tabPages
      .map(page => page.name)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

    const defaultIndexSource = customOptions['defaultTabIndex'];
    const defaultTabIndex = typeof defaultIndexSource === 'number'
      ? Math.max(0, Math.min(tabPageNames.length - 1, Math.floor(defaultIndexSource)))
      : 0;

    const params = serializeElement(rootElement);
    const uiParams = serializeParamToTypescript(params, 3, strings);

    const buttonNamesJson = this.escapeForSingleQuotedString(JSON.stringify(tabButtonNames));
    const pageNamesJson = this.escapeForSingleQuotedString(JSON.stringify(tabPageNames));

    return replacePlaceholders(this.templateCache, {
      CLASS_NAME: className,
      TIMESTAMP: timestamp,
      UI_PARAMS: uiParams,
      TAB_BUTTON_NAMES_JSON: buttonNamesJson,
      TAB_PAGE_NAMES_JSON: pageNamesJson,
      TAB_DEFAULT_INDEX: defaultTabIndex.toString(),
    });
  }
}

export const TAB_MENU_ID = 'tab-menu';

/**
 * Blueprint structure for the tab menu preset.
 *
 * Designers can reposition the root container and rename any of the button/page widgets.
 * Drop tab-specific content directly inside the `TabPageXX` containers – the export step
 * tracks their generated IDs so renaming will not break the runtime script.
 */
const blueprint: UIParams = {
  name: 'TabMenuContainer',
  type: 'Container',
  position: [64, 96],
  size: [420, 280],
  anchor: UIAnchor.TopLeft,
  visible: true,
  padding: 0,
  bgColor: [0.16, 0.16, 0.2],
  bgAlpha: 0.95,
  bgFill: UIBgFill.Blur,
  children: [
    {
      name: 'TabMenuHeader',
      type: 'Container',
      position: [0, 0],
      size: [420, 56],
      anchor: UIAnchor.TopLeft,
      visible: true,
      padding: 8,
      bgColor: [0.08, 0.08, 0.12],
      bgAlpha: 0.9,
      bgFill: UIBgFill.Solid,
      children: [
        {
          name: 'TabButtonRow',
          type: 'Container',
          position: [0, 0],
          size: [404, 40],
          anchor: UIAnchor.CenterLeft,
          visible: true,
          padding: 4,
          bgColor: [0.06, 0.06, 0.08],
          bgAlpha: 0.6,
          bgFill: UIBgFill.None,
          children: [
            {
              name: 'TabButton01',
              type: 'Button',
              position: [0, 0],
              size: [128, 40],
              anchor: UIAnchor.CenterLeft,
              visible: true,
              padding: 6,
              bgColor: [0.24, 0.24, 0.3],
              bgAlpha: 0.9,
              bgFill: UIBgFill.Solid,
              buttonEnabled: true,
              buttonColorBase: [0.35, 0.35, 0.42],
              buttonAlphaBase: 1,
              buttonColorHover: [0.45, 0.45, 0.55],
              buttonAlphaHover: 1,
              buttonColorPressed: [0.55, 0.55, 0.7],
              buttonAlphaPressed: 1,
              buttonColorFocused: [0.6, 0.6, 0.76],
              buttonAlphaFocused: 1,
              buttonColorDisabled: [0.2, 0.2, 0.25],
              buttonAlphaDisabled: 0.4,
              children: [
                {
                  name: 'TabButton01Label',
                  type: 'Text',
                  position: [0, 0],
                  size: [116, 28],
                  anchor: UIAnchor.Center,
                  visible: true,
                  padding: 0,
                  bgColor: [0, 0, 0],
                  bgAlpha: 0,
                  bgFill: UIBgFill.None,
                  textLabel: 'Tab 1',
                  textColor: [1, 1, 1],
                  textAlpha: 1,
                  textSize: 20,
                  textAnchor: UIAnchor.Center,
                },
              ],
            },
            {
              name: 'TabButton02',
              type: 'Button',
              position: [138, 0],
              size: [128, 40],
              anchor: UIAnchor.CenterLeft,
              visible: true,
              padding: 6,
              bgColor: [0.24, 0.24, 0.3],
              bgAlpha: 0.9,
              bgFill: UIBgFill.Solid,
              buttonEnabled: true,
              buttonColorBase: [0.35, 0.35, 0.42],
              buttonAlphaBase: 1,
              buttonColorHover: [0.45, 0.45, 0.55],
              buttonAlphaHover: 1,
              buttonColorPressed: [0.55, 0.55, 0.7],
              buttonAlphaPressed: 1,
              buttonColorFocused: [0.6, 0.6, 0.76],
              buttonAlphaFocused: 1,
              buttonColorDisabled: [0.2, 0.2, 0.25],
              buttonAlphaDisabled: 0.4,
              children: [
                {
                  name: 'TabButton02Label',
                  type: 'Text',
                  position: [0, 0],
                  size: [116, 28],
                  anchor: UIAnchor.Center,
                  visible: true,
                  padding: 0,
                  bgColor: [0, 0, 0],
                  bgAlpha: 0,
                  bgFill: UIBgFill.None,
                  textLabel: 'Tab 2',
                  textColor: [1, 1, 1],
                  textAlpha: 1,
                  textSize: 20,
                  textAnchor: UIAnchor.Center,
                },
              ],
            },
            {
              name: 'TabButton03',
              type: 'Button',
              position: [276, 0],
              size: [128, 40],
              anchor: UIAnchor.CenterLeft,
              visible: true,
              padding: 6,
              bgColor: [0.24, 0.24, 0.3],
              bgAlpha: 0.9,
              bgFill: UIBgFill.Solid,
              buttonEnabled: true,
              buttonColorBase: [0.35, 0.35, 0.42],
              buttonAlphaBase: 1,
              buttonColorHover: [0.45, 0.45, 0.55],
              buttonAlphaHover: 1,
              buttonColorPressed: [0.55, 0.55, 0.7],
              buttonAlphaPressed: 1,
              buttonColorFocused: [0.6, 0.6, 0.76],
              buttonAlphaFocused: 1,
              buttonColorDisabled: [0.2, 0.2, 0.25],
              buttonAlphaDisabled: 0.4,
              children: [
                {
                  name: 'TabButton03Label',
                  type: 'Text',
                  position: [0, 0],
                  size: [116, 28],
                  anchor: UIAnchor.Center,
                  visible: true,
                  padding: 0,
                  bgColor: [0, 0, 0],
                  bgAlpha: 0,
                  bgFill: UIBgFill.None,
                  textLabel: 'Tab 3',
                  textColor: [1, 1, 1],
                  textAlpha: 1,
                  textSize: 20,
                  textAnchor: UIAnchor.Center,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'TabPagesContainer',
      type: 'Container',
      position: [0, 64],
      size: [420, 216],
      anchor: UIAnchor.TopLeft,
      visible: true,
      padding: 12,
      bgColor: [0.1, 0.1, 0.14],
      bgAlpha: 0.7,
      bgFill: UIBgFill.None,
      children: [
        {
          name: 'TabPage01',
          type: 'Container',
          position: [0, 0],
          size: [396, 192],
          anchor: UIAnchor.TopLeft,
          visible: true,
          padding: 12,
          bgColor: [0.14, 0.14, 0.18],
          bgAlpha: 0.85,
          bgFill: UIBgFill.Blur,
          children: [
            {
              name: 'TabPage01Hint',
              type: 'Text',
              position: [0, 0],
              size: [372, 28],
              anchor: UIAnchor.TopLeft,
              visible: true,
              padding: 0,
              bgColor: [0, 0, 0],
              bgAlpha: 0,
              bgFill: UIBgFill.None,
              textLabel: 'Drop Tab 1 content here',
              textColor: [0.85, 0.88, 0.93],
              textAlpha: 0.9,
              textSize: 18,
              textAnchor: UIAnchor.TopLeft,
            },
          ],
        },
        {
          name: 'TabPage02',
          type: 'Container',
          position: [0, 0],
          size: [396, 192],
          anchor: UIAnchor.TopLeft,
          visible: true,
          padding: 12,
          bgColor: [0.14, 0.14, 0.18],
          bgAlpha: 0.85,
          bgFill: UIBgFill.Blur,
          children: [
            {
              name: 'TabPage02Hint',
              type: 'Text',
              position: [0, 0],
              size: [372, 28],
              anchor: UIAnchor.TopLeft,
              visible: true,
              padding: 0,
              bgColor: [0, 0, 0],
              bgAlpha: 0,
              bgFill: UIBgFill.None,
              textLabel: 'Drop Tab 2 content here',
              textColor: [0.85, 0.88, 0.93],
              textAlpha: 0.9,
              textSize: 18,
              textAnchor: UIAnchor.TopLeft,
            },
          ],
        },
        {
          name: 'TabPage03',
          type: 'Container',
          position: [0, 0],
          size: [396, 192],
          anchor: UIAnchor.TopLeft,
          visible: true,
          padding: 12,
          bgColor: [0.14, 0.14, 0.18],
          bgAlpha: 0.85,
          bgFill: UIBgFill.Blur,
          children: [
            {
              name: 'TabPage03Hint',
              type: 'Text',
              position: [0, 0],
              size: [372, 28],
              anchor: UIAnchor.TopLeft,
              visible: true,
              padding: 0,
              bgColor: [0, 0, 0],
              bgAlpha: 0,
              bgFill: UIBgFill.None,
              textLabel: 'Drop Tab 3 content here',
              textColor: [0.85, 0.88, 0.93],
              textAlpha: 0.9,
              textSize: 18,
              textAnchor: UIAnchor.TopLeft,
            },
          ],
        },
      ],
    },
  ],
};

export const tabMenuPreset: UIAdvancedPresetDefinition = {
  id: TAB_MENU_ID,
  label: 'Tab menu Container',
  version: '1.0.0',
  description: 'Widget that allows switching between multiple tabs of content.',
  defaultClassName: 'TabMenuWidget',
  defaultRootName: 'TabMenuContainer',
  blueprint,
  slots: [
    {
      id: 'tabContent',
      label: 'Tab Content',
      description: 'Content area for each tab in the tab menu.',
      allowedTypes: ['Text', 'Image', 'Button', 'Container'],
      multiplicity: 'list',
      minItems: 1,
    },
  ],
  exportGenerator: new TabMenuExportGenerator(),
};
