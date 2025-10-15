import { UiBuilderService } from './ui-builder.service';

describe('UiBuilderService', () => {
  let service: UiBuilderService;

  beforeEach(() => {
    service = new UiBuilderService();
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
