//@ts-ignore
/**
 * Common interface that all advanced widget classes should implement.
 * This ensures consistent API across all generated widgets.
 * 
 * NOTE: This file is for documentation purposes only. The actual interface
 * is not enforced at runtime since widgets are generated as standalone classes.
 * Use this as a reference when creating new widget templates.
 * 
 * Ideally if someone generates ui with the tool they can implement this interface manually in exported code and handle widget lifecycle properly.
 */
export interface IAdvancedWidget {
  /**
   * Useful widget instances should be created and stored in public properties.
   * We can also, at the end of the create() method, chain `mod.FindUIWidgetWithName(...)` and assign them there.
   */
  rootWidget: mod.UIWidget;

  /**
   * Creates and initializes the widget.
   * Should call modlib.ParseUI() and set up any widget references.
   * @returns The root widget instance
   */
  create(): mod.UIWidget;

  /**
   * Updates the widget state and refreshes the display.
   * The specific behavior depends on the widget type.
   * @returns Optional return value (e.g., new counter value)
   */
  refreshUi?(): any;

  /**
   * Destroys the widget and cleans up resources.
   * Should be implemented if the widget needs cleanup.
   */
  destroy?(): void;
}
