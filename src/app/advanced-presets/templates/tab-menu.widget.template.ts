// @ts-nocheck
// Generated tab menu widget scaffold.
// Button and page names are provided by the UI Builder metadata so designers can safely rename widgets.
export class {{CLASS_NAME}} {
  public containerWidget: mod.UIWidget | undefined;
  public tabButtons: mod.UIWidget[] = [];
  public tabPages: mod.UIWidget[] = [];

  private activeTabIndex = 0;
  private handlersRegistered = false;

  private readonly buttonNames: string[] = JSON.parse('{{TAB_BUTTON_NAMES_JSON}}');
  private readonly pageNames: string[] = JSON.parse('{{TAB_PAGE_NAMES_JSON}}');
  private readonly defaultTabIndex: number = Number('{{TAB_DEFAULT_INDEX}}');

  public create(owner: mod.Player | mod.Team | null = null): void {
    this.containerWidget = modlib.ParseUI(
{{UI_PARAMS}}
    );
    this.activeTabIndex = 0;
    this.handlersRegistered = false;
    this.resolveWidgets();
    this.registerButtonHandlers();
    this.setActiveTab(this.defaultTabIndex);
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
    if (this.containerWidget) {
      mod.DeleteUIWidget(this.containerWidget);
    }
    this.containerWidget = undefined;
    this.tabButtons = [];
    this.tabPages = [];
    this.handlersRegistered = false;
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

  private registerButtonHandlers(): void {
    if (this.handlersRegistered) {
      return;
    }

    this.tabButtons.forEach((buttonWidget, index) => {
      if (!buttonWidget) {
        return;
      }

      mod.RegisterUIEventHandler(buttonWidget, mod.UIButtonEvent.ButtonUp, () => {
        this.setActiveTab(index);
      });
    });

    this.handlersRegistered = true;
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
}
