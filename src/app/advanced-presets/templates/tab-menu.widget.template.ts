// @ts-nocheck
// Generated tab menu widget scaffold.
// Button and page names are provided by the UI Builder metadata so designers can safely rename widgets.
export class {{CLASS_NAME}} {
  private static instances: {{CLASS_NAME}}[] = [];

  public containerWidget: mod.UIWidget | undefined;
  public tabButtons: mod.UIWidget[] = [];
  public tabPages: mod.UIWidget[] = [];

  private activeTabIndex = 0;

  private readonly buttonNames: string[] = JSON.parse('{{TAB_BUTTON_NAMES_JSON}}');
  private readonly pageNames: string[] = JSON.parse('{{TAB_PAGE_NAMES_JSON}}');
  private readonly defaultTabIndex: number = Number('{{TAB_DEFAULT_INDEX}}');

  public create(owner: mod.Player | mod.Team | null = null): void {
    this.containerWidget = modlib.ParseUI(
{{UI_PARAMS}}
    );
    this.activeTabIndex = 0;
    this.resolveWidgets();
  this.setActiveTab(this.defaultTabIndex);
  {{CLASS_NAME}}.registerInstance(this);
  }

  public setActiveTab(index: number): void {
    if (!this.tabPages.length) {
      return;
    }

    const clampedIndex = this.clamp(index, 0, this.tabPages.length - 1);
    if (clampedIndex === this.activeTabIndex) {
      this.refreshTabs();
      return;
    }

    this.activeTabIndex = clampedIndex;
    this.refreshTabs();
  }

  public nextTab(): void {
    if (!this.tabPages.length) {
      return;
    }
    const nextIndex = (this.activeTabIndex + 1) % this.tabPages.length;
    this.setActiveTab(nextIndex);
  }

  public previousTab(): void {
    if (!this.tabPages.length) {
      return;
    }
    const previousIndex = (this.activeTabIndex - 1 + this.tabPages.length) % this.tabPages.length;
    this.setActiveTab(previousIndex);
  }

  public destroy(): void {
    {{CLASS_NAME}}.unregisterInstance(this);
    if (this.containerWidget) {
      mod.DeleteUIWidget(this.containerWidget);
    }
    this.containerWidget = undefined;
    this.tabButtons = [];
    this.tabPages = [];
    this.activeTabIndex = 0;
  }

  private resolveWidgets(): void {
    this.tabButtons = this.buttonNames
      .map(name => mod.FindUIWidgetWithName(name))
      .filter((widget): widget is mod.UIWidget => !!widget);

    this.tabPages = this.pageNames
      .map(name => mod.FindUIWidgetWithName(name))
      .filter((widget): widget is mod.UIWidget => !!widget);
  }

  public handleButtonEvent(eventWidget: mod.UIWidget, eventType: mod.UIButtonEvent): boolean {
    if (!eventWidget || eventType !== mod.UIButtonEvent.ButtonUp) {
      return false;
    }

    if (!this.tabButtons.length) {
      this.resolveWidgets();
    }

    const buttonIndex = this.tabButtons.findIndex(button => button === eventWidget);
    if (buttonIndex === -1) {
      return false;
    }

    this.setActiveTab(buttonIndex);
    return true;
  }

  private refreshTabs(): void {
    this.tabPages.forEach((pageWidget, index) => {
      if (!pageWidget) {
        return;
      }
      mod.SetUIWidgetVisible(pageWidget, index === this.activeTabIndex);
    });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private static registerInstance(instance: {{CLASS_NAME}}): void {
    if (this.instances.includes(instance)) {
      return;
    }
    this.instances.push(instance);
  }

  private static unregisterInstance(instance: {{CLASS_NAME}}): void {
    const index = this.instances.indexOf(instance);
    if (index !== -1) {
      this.instances.splice(index, 1);
    }
  }

  public static dispatchButtonEvent(eventWidget: mod.UIWidget, eventType: mod.UIButtonEvent): boolean {
    if (!this.instances.length) {
      return false;
    }

    for (const instance of [...this.instances]) {
      if (instance.handleButtonEvent(eventWidget, eventType)) {
        return true;
      }
    }

    return false;
  }
}

const previous{{CLASS_NAME}}OnPlayerUIButtonEvent =
  typeof globalThis !== 'undefined' && typeof (globalThis as any).OnPlayerUIButtonEvent === 'function'
    ? (globalThis as any).OnPlayerUIButtonEvent
    : null;

export function OnPlayerUIButtonEvent(
  eventPlayer: mod.Player,
  eventUIWidget: mod.UIWidget,
  eventUIButtonEvent: mod.UIButtonEvent
): void {
  const handled = {{CLASS_NAME}}.dispatchButtonEvent(eventUIWidget, eventUIButtonEvent);
  if (handled) {
    return;
  }

  if (previous{{CLASS_NAME}}OnPlayerUIButtonEvent) {
    previous{{CLASS_NAME}}OnPlayerUIButtonEvent(eventPlayer, eventUIWidget, eventUIButtonEvent);
  }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).OnPlayerUIButtonEvent = OnPlayerUIButtonEvent;
}
