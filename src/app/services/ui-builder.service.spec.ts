import { UiBuilderService } from './ui-builder.service';

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
});
