export class {{CLASS_NAME}} {
  public containerWidget: mod.UIWidget = null;
  public textWidget: mod.UIWidget = null;

  private counterValue = 0;

  public create(): mod.UIWidget {
    this.counterValue = 0;
    this.containerWidget = modlib.ParseUI(
{{UI_PARAMS}}
    );
    this.textWidget = mod.FindUIWidgetWithName('CounterText');
    this.refreshUi();
    return this.containerWidget;
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

  pulic destroy() {
    if (this.containerWidget) {
        mod.DeleteUIWidget(this.containerWidget);
    }
  }

  private refreshUi(): void {
    mod.SetUITextLabel(this.textWidget, mod.Message(this.counterValue.toString()));
  }

}
