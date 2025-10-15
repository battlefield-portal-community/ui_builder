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
    { value: UIBgFill.Solid, label: 'Solid' },
    { value: UIBgFill.Blur, label: 'Blur' },
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
}