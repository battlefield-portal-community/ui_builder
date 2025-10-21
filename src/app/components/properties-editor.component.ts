import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiBuilderService } from '../services/ui-builder.service';
import { UIElement, UIAnchor, UIBgFill, UIImageType } from '../../models/types';

@Component({
  selector: 'app-properties-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties-editor.component.html',
  styleUrl: './properties-editor.component.scss'
})
export class PropertiesEditorComponent {
  selectedElement = computed(() => this.uiBuilder.getSelectedElement());

  readonly colorPalette: readonly string[] = [
    '#FFFFFF',
    '#D5EBF9',
    '#545E63',
    '#36393C',
    '#080B0B',
    '#70EBFF',
    '#132F3F',
    '#FF8361',
    '#401811',
    '#ADFD86',
    '#477236',
    '#FFFC9C',
    '#716000',
  ];

  private readonly colorProperties: readonly (keyof Pick<UIElement, 'textColor' | 'bgColor' | 'imageColor' | 'buttonColorBase'>)[] = [
    'textColor',
    'bgColor',
    'imageColor',
    'buttonColorBase',
  ];

  anchorOptions = [
    { value: UIAnchor.TopLeft, label: 'Top Left' },
    { value: UIAnchor.TopCenter, label: 'Top Center' },
    { value: UIAnchor.TopRight, label: 'Top Right' },
    { value: UIAnchor.CenterLeft, label: 'Center Left' },
    { value: UIAnchor.Center, label: 'Center' },
    { value: UIAnchor.CenterRight, label: 'Center Right' },
    { value: UIAnchor.BottomLeft, label: 'Bottom Left' },
    { value: UIAnchor.BottomCenter, label: 'Bottom Center' },
    { value: UIAnchor.BottomRight, label: 'Bottom Right' },
  ];

  bgFillOptions = [
    { value: UIBgFill.None, label: 'None' },
    { value: UIBgFill.Blur, label: 'Blur' },
    { value: UIBgFill.Solid, label: 'Solid' },
    { value: UIBgFill.OutlineThin, label: 'Outline Thin' },
    { value: UIBgFill.OutlineThick, label: 'Outline Thick' },
    { value: UIBgFill.GradientTop, label: 'Gradient Top' },
    { value: UIBgFill.GradientBottom, label: 'Gradient Bottom' },
    { value: UIBgFill.GradientLeft, label: 'Gradient Left' },
    { value: UIBgFill.GradientRight, label: 'Gradient Right' },
  ];

  imageTypeOptions = [
    { value: UIImageType.None, label: 'None' },
    { value: UIImageType.QuestionMark, label: 'Question Mark' },
    { value: UIImageType.CrownOutline, label: 'Crown Outline' },
    { value: UIImageType.CrownSolid, label: 'Crown Solid' },
    { value: UIImageType.RifleAmmo, label: 'Rifle Ammo' },
    { value: UIImageType.SelfHeal, label: 'Self Heal' },
    { value: UIImageType.SpawnBeacon, label: 'Spawn Beacon' },
    { value: UIImageType.TEMP_PortalIcon, label: 'Portal Icon' },
  ];

  constructor(private uiBuilder: UiBuilderService) {}

  toggleLock(element: UIElement, event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    this.uiBuilder.setElementLocked(element.id, input.checked);
  }

  updateProperty(property: string, event: any) {
    const element = this.selectedElement();
    if (!element) return;

    let value: any;
    
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    } else if (event.target.type === 'number') {
      value = parseFloat(event.target.value) || 0;
    } else if (event.target.tagName === 'SELECT') {
      value = parseInt(event.target.value);
    } else {
      value = event.target.value;
    }

    if (property === 'anchor') {
      const anchorValue = Number.isNaN(value) ? UIAnchor.TopLeft : (value as UIAnchor);
      this.uiBuilder.updateElement(element.id, {
        anchor: anchorValue,
        position: [0, 0],
      });
      return;
    }

    this.uiBuilder.updateElement(element.id, { [property]: value });
  }

  updateVectorProperty(property: string, index: number, event: any) {
    const element = this.selectedElement();
    if (!element) return;

    const currentValue = (element as any)[property] as number[];
    const newValue = [...currentValue];
    newValue[index] = parseFloat(event.target.value) || 0;

    this.uiBuilder.updateElement(element.id, { [property]: newValue });
  }

  getColorPreview(color: number[]): string {
    const [r, g, b] = color;
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  colorArrayToHex(color: number[]): string {
    const [r, g, b] = color;
    const toHex = (value: number) => {
      const intValue = Math.max(0, Math.min(255, Math.round(value * 255)));
      return intValue.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  setColorProperty(property: keyof UIElement, hexValue: string) {
    const element = this.selectedElement();
    if (!element || !this.isColorProperty(property)) {
      return;
    }

    const normalizedColor = this.hexToNormalizedArray(hexValue);
    this.uiBuilder.updateElement(element.id, { [property]: normalizedColor } as Partial<UIElement>);
  }

  onColorPickerChange(property: keyof UIElement, event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    this.setColorProperty(property, input.value);
  }

  isPaletteColorSelected(currentColor: number[], hexValue: string): boolean {
    return this.colorArrayToHex(currentColor).toUpperCase() === hexValue.toUpperCase();
  }

  private isColorProperty(property: keyof UIElement): property is typeof this.colorProperties[number] {
    return this.colorProperties.includes(property as typeof this.colorProperties[number]);
  }

  private hexToNormalizedArray(hexValue: string): number[] {
    const normalizedHex = hexValue.trim().replace('#', '');
    if (normalizedHex.length !== 6) {
      return [1, 1, 1];
    }

    const parseChannel = (channel: string) => Math.max(0, Math.min(1, parseInt(channel, 16) / 255));

    const r = parseChannel(normalizedHex.slice(0, 2));
    const g = parseChannel(normalizedHex.slice(2, 4));
    const b = parseChannel(normalizedHex.slice(4, 6));

    return [r, g, b];
  }
}