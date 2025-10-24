export class {{CLASS_NAME}} {
  public containerWidget: mod.UIWidget | undefined;
  public textWidget: mod.UIWidget | undefined;

  private counterValue = 0;

  public create(owner: mod.Player | mod.Team | null = null): void {
    this.counterValue = 0;
    this.containerWidget = modlib.ParseUI(
{{UI_PARAMS}}
    );
    this.textWidget = mod.FindUIWidgetWithName('CounterText');
    this.refreshUi();
  }

  public increment(): number {
    this.counterValue += 1;
    this.refreshUi();
    return this.counterValue;
  }

  public decrement(): number {
    this.counterValue -= 1;
    this.refreshUi();
    return this.counterValue;
  }

  public destroy() {
    if (this.containerWidget) {
        mod.DeleteUIWidget(this.containerWidget);
    }
  }

  private refreshUi(): void {
    if (!this.textWidget) return;
    mod.SetUITextLabel(this.textWidget, mod.Message(this.counterValue.toString()));
  }

}
