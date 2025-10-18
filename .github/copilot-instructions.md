#ck Copilot Instructions for ui_builder
a

- **Stack**: Angular 20 standalone app bootstrapped in `src/main.ts` with config from `src/app/app.config.ts`; no NgModules, everything is provided via signals-aware providers.
- **Entry layout**: `src/app/app.ts` renders three siblings (`SideMenuComponent`, `CanvasComponent`, `PropertiesEditorComponent`) that all talk to the same `UiBuilderService` store.
- **State hub**: `src/app/services/ui-builder.service.ts` is the single source of truth using Angular signals; always go through its APIs (`addElement`, `updateElement`, `generateExportArtifacts`, etc.) instead of mutating component-local state.
- **UI model**: Types live in `src/models/types.ts`; respect the enums (`UIAnchor`, `UIBgFill`, `UIImageType`) and the default constants (`DEFAULT_UI_PARAMS`, `CANVAS_WIDTH`, `CANVAS_HEIGHT`). New element properties should extend `UIElement` and flow through `DEFAULT_UI_PARAMS`.
- **Element hierarchy**: Elements form a tree (`children: UIElement[]`); service helpers like `updateElementRecursive`, `moveElement`, and `getElementLocation` already handle traversal—reuse them rather than duplicating tree logic.
- **Canvas behavior**: `src/app/components/canvas.component.ts` manages zoom, drag, resize, delete, and snapping. Mouse coordinates are translated from scaled pixels back to 1920×1080 space; keep calculations in sync with `this.scale` and `UiBuilderService.elementBounds()` when adding interactions.
- **Snap guides**: Snapping thresholds come from `CanvasComponent.snapThreshold` and `UiBuilderService.getElementBounds`; ensure new guides update both the signal `snapGuides` and the computed bounds.
- **Keyboard handling**: Canvas listens globally for `Delete`; when adding shortcuts prefer centralized listeners in `CanvasComponent` so cleanup in `ngOnDestroy` stays accurate.
- **Side menu**: `side-menu.component.*` flattens the element tree for display, manages background assets, and surfaces export modals. Uploads call `UiBuilderService.addCanvasBackgroundImageFromFile`, which tracks `URL.createObjectURL` handles—remember to invoke `removeCanvasBackgroundImage` or `clearCanvasBackgroundImages` so we revoke URLs.
- **Properties editor**: `properties-editor.component.ts` binds Angular forms directly to service data. `updateProperty` resets position on anchor change; follow that pattern if adding coupled fields.
- **Backgrounds**: Default background metadata sits in the service (`DEFAULT_CANVAS_BACKGROUND_IMAGE`). New presets belong under `src/assets/bg_canvas/` and should be registered via `addCanvasBackgroundImageFromPath` to get normalized IDs and labels.
- **Exports**: `UiBuilderService.generateExportArtifacts()` returns params JSON, localization strings, and a Battlefield-friendly TypeScript snippet via `buildTypescriptCode`. Update serialization helpers (`formatEnumValue`, `serializeParamToTypescript`) whenever adding fields so exports stay consistent.
- **Testing**: No testing framework is set up. Manual tests can be run by executing `npm start` and verifying behavior in the browser. Don't generate any spec or test files
- **Dev workflow**: `npm start` serves on http://localhost:4200 with live reload; `npm run build` produces `dist/`. Dockerfile serves the production build via Nginx on port 8080.
- **Formatting**: Prettier config in `package.json` enforces 100-char width and single quotes; run `npx prettier "src/**/*.{ts,html,scss}" --write` if formatting drifts.
- **Signals-first**: Components lean on `computed`/`signal`. When introducing async work, prefer converting to signals (e.g., `fromObservable` transforms) rather than reverting to RxJS Subjects.
- **Error handling**: `provideBrowserGlobalErrorListeners()` is enabled; surface user-facing errors via UI components, not console-only logs.
- **New UI controls**: Add their enums/types in `models/types.ts`, defaults in `DEFAULT_UI_PARAMS`, creation logic in the service, and editing controls in both `side-menu` (element library) and `properties-editor`.
- **Asset cleanup**: The service keeps `_uploadedObjectUrls`; when programmatically generating object URLs, push them through the same set so `clearCanvasBackgroundImages` can revoke them.
- **ID generation**: `createUIElement` appends a random 5-char suffix; maintain this convention so export string keys remain predictable and unique.
- **Anchoring math**: Both snapping and exports depend on `getAnchorStartCoordinates`/`getAnchorOffset` implementations in the service; update those helpers in tandem with any new anchor behaviors.
- **Sizing constraints**: Canvas enforces minimum size of 10px during resize; keep constraints centralized in `onMouseMove` when expanding resize modes.
- **Localization**: Text nodes with non-empty `textLabel` generate entries in `stringsJson`. Use `getLocalizationKey` to map names to keys instead of embedding plain text in the exported TS.
- **CI expectations**: No automated pipeline exists; before opening PRs run `npm run build` and `npm test`, and include updated export fixtures when behavior changes.
