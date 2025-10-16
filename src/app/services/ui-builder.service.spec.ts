import { UiBuilderService } from './ui-builder.service';
import { UIAnchor } from '../../models/types';

describe('UiBuilderService', () => {
  let service: UiBuilderService;

  beforeEach(() => {
    service = new UiBuilderService();
  });

  it('should default to the grid background image', () => {
    expect(service.canvasBackgroundMode()).toBe('image');
    expect(service.canvasBackgroundImage()).toBe(service.defaultCanvasBackgroundImageId);

    const url = service.canvasBackgroundImageUrl();
    expect(url).toBe(service.defaultCanvasBackgroundImage.url);
  });

  it('should generate default names with random 5-character suffix', () => {
    const element = service.createUIElement('Container');
    expect(element.name).toMatch(/^Container_[A-Z0-9]{5}$/);

    service.addElement('Text');
    const selected = service.getSelectedElement();
    expect(selected).toBeTruthy();
    expect(selected!.name).toMatch(/^Text_[A-Z0-9]{5}$/);
  });

  it('should allow registering custom backgrounds and keep selection when switching modes', () => {
    const asset = service.addCanvasBackgroundImageFromPath('assets/bg_canvas/custom-background.png');
    expect(asset).toBeTruthy();
    expect(service.canvasBackgroundImages().length).toBe(1);

    service.setCanvasBackgroundImage(asset!.id);
    expect(service.canvasBackgroundImage()).toBe(asset!.id);
    expect(service.canvasBackgroundImageUrl()).toBe(asset!.url);

    service.setCanvasBackgroundMode('white');
    expect(service.canvasBackgroundMode()).toBe('white');
    expect(service.canvasBackgroundImage()).toBe(asset!.id);

    service.setCanvasBackgroundMode('image');
    expect(service.canvasBackgroundMode()).toBe('image');
    expect(service.canvasBackgroundImage()).toBe(asset!.id);
  });

  it('should support image uploads via File objects', () => {
    const file = new File(['test'], 'upload-bg.png', { type: 'image/png' });
    const asset = service.addCanvasBackgroundImageFromFile(file);

    expect(asset).toBeTruthy();
    expect(asset!.label).toContain('upload-bg');
    expect(service.canvasBackgroundImages().some(item => item.id === asset!.id)).toBeTrue();

    service.removeCanvasBackgroundImage(asset!.id);
    expect(service.canvasBackgroundImages().length).toBe(0);
  });

  it('should generate export artifacts including TypeScript and strings JSON', () => {
    service.addElement('Container', 'rootContainer');
    const containerId = service.selectedElementId();
    expect(containerId).toBeTruthy();

    service.addElement('Text', 'greetingText');
    const greetingId = service.selectedElementId();
    expect(greetingId).toBeTruthy();
    service.updateElement(greetingId!, { textLabel: 'Hello Operator' });

    service.selectElement(containerId!);
    service.addElement('Text', 'emptyText');
    const emptyTextId = service.selectedElementId();
    expect(emptyTextId).toBeTruthy();
    service.updateElement(emptyTextId!, { textLabel: '   ' });

    const artifacts = service.generateExportArtifacts();

    const paramsArray = JSON.parse(artifacts.paramsJson) as unknown[];
    expect(paramsArray.length).toBe(1);
    expect(artifacts.params[0].name).toBe('rootContainer');

    const parsedStrings = JSON.parse(artifacts.stringsJson);
    expect(parsedStrings).toEqual({ greetingText: 'Hello Operator' });
    expect(artifacts.strings).toEqual({ greetingText: 'Hello Operator' });

    expect(artifacts.typescriptCode).toContain('export const widget = modlib.ParseUI(');
    expect(artifacts.typescriptCode).toContain('UIAnchor.');
    expect(artifacts.typescriptCode).toContain('textLabel: mod.greetingText');
    expect(artifacts.typescriptCode).not.toContain('Hello Operator');
    expect(artifacts.typescriptCode).not.toContain('buttonColorBase');
    expect(artifacts.typescriptCode).toContain('buttonEnabled: false');
  });

  it('should include button style properties when buttonEnabled is true', () => {
    service.addElement('Button', 'primaryButton');
    const buttonId = service.selectedElementId();
    expect(buttonId).toBeTruthy();

    service.updateElement(buttonId!, {
      buttonEnabled: true,
      buttonColorBase: [1, 0, 0],
      buttonAlphaBase: 1,
    });

    const artifacts = service.generateExportArtifacts();

    expect(artifacts.typescriptCode).toContain('buttonEnabled: true');
    expect(artifacts.typescriptCode).toContain('buttonColorBase: [1, 0, 0]');
    expect(artifacts.typescriptCode).toContain('buttonAlphaBase: 1');
  });

  it('should default snap-to-elements to true and allow toggling', () => {
    expect(service.snapToElements()).toBeTrue();

    service.setSnapToElements(false);
    expect(service.snapToElements()).toBeFalse();

    service.toggleSnapToElements();
    expect(service.snapToElements()).toBeTrue();
  });

  it('should compute absolute element bounds with hierarchy and anchors', () => {
    service.addElement('Container', 'RootContainer');
    const parentId = service.selectedElementId();
    expect(parentId).toBeTruthy();

    service.updateElement(parentId!, {
      position: [100, 120],
      size: [200, 300],
      anchor: UIAnchor.TopLeft,
    });

    service.selectElement(parentId!);
    service.addElement('Text', 'ChildText');
    const childId = service.selectedElementId();
    expect(childId).toBeTruthy();

    service.updateElement(childId!, {
      position: [0, 0],
      size: [50, 50],
      anchor: UIAnchor.Center,
    });

    const allBounds = service.elementBounds();
    expect(allBounds.length).toBe(2);

    const parentBounds = service.getElementBounds(parentId!);
    const childBounds = service.getElementBounds(childId!);

    expect(parentBounds).toBeTruthy();
    expect(parentBounds!.parentId).toBeNull();
    expect(parentBounds!.rect.left).toBe(100);
    expect(parentBounds!.rect.top).toBe(120);
    expect(parentBounds!.rect.width).toBe(200);
    expect(parentBounds!.rect.height).toBe(300);

    expect(childBounds).toBeTruthy();
    expect(childBounds!.parentId).toBe(parentId);
    expect(childBounds!.rect.width).toBe(50);
    expect(childBounds!.rect.height).toBe(50);
    expect(childBounds!.rect.left).toBe(175);
    expect(childBounds!.rect.top).toBe(245);
    expect(childBounds!.rect.centerX).toBe(200);
    expect(childBounds!.rect.centerY).toBe(270);
  });
});
