# BfUiBuilder

![Angular Version](https://img.shields.io/badge/angular-20.3-cc0000?logo=angular&logoColor=white)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

BfUiBuilder is a browser-based layout designer for Battlefield Portal user interfaces. It pairs a drag-and-drop canvas with an inspection panel so you can prototype menus, HUD widgets, and overlays without writing code by hand. Once you're satisfied with the layout you can export strongly typed TypeScript and localization JSON, ready to drop into your mod tooling.

## Features

- **Visual canvas** scaled from the in-game 1920×1080 safe area with zoom controls and snapping guides.
- **Element library** for Containers, Text, Images, and Buttons, including nesting and reordering from the side menu.
- **Property editor** to tweak anchors, positions, sizes, typography, colors, backgrounds, padding, and button states.
- **Background presets** with quick switching between solid, grid, and custom uploaded imagery.
- **One-click exports** that generate TypeScript structures plus optional string maps.

## Todo
- Image previews
- Buttons bound function
- Ctrl+z
- Padding
- Drag and drop in the element hierarchy
- More example backgrounds
- Support more resolutions than just 1080p altough the current resolution is faked
- Tab and menus with code that handles showing and hiding the correct page
- Save and continue later (are cookies enough ?)
- Better error logging
- Multiple ParseUi calls for root containers as default export format

## Bugs
- Ability to add sub elements to a text container (need to test in game if that's legal)
- Some UI scrollbars shouldn't be visible (general responsiveness)
- Zooming breaks element positionning
  - background zooming and canvas zooming don't have the same zoom ratios
- Buttons are not in the correct format
- Import doesn't work for more than one ParseUi calls
- Spaces are generated in the stringkeys in typescript which messes the parsing up

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.19 or later (LTS recommended)
- [Angular CLI](https://angular.dev/tools/cli) 20.3 globally installed if you plan to use the `ng` helper commands (`npm install -g @angular/cli`)

### Install and run

1. Clone the repository.
2. Install dependencies.

```powershell
npm install
npm run start
```
Open `http://localhost:4200/` in your browser.

### Run with Docker

```powershell
docker build -t bf-ui-builder .
docker run --rm -p 8080:80 bf-ui-builder
```

Then navigate to `http://localhost:8080/ui-builder`.

## 🧭 Using the builder

| Area | What it does |
| --- | --- |
| **Side Menu** | Add new elements, view the hierarchy, reorder items, toggle snapping, manage canvas backgrounds, and trigger exports. |
| **Canvas** | Drag elements, resize handles, zoom with the mouse wheel, and click empty space to deselect. Snapping guides appear when alignment is close. |
| **Properties Editor** | Fine-tune numeric values, select anchors, adjust colors, switch image glyphs, and enable button state styling. |

### Typical workflow

1. **Create elements** from the Side Menu. Selected parents receive new children, otherwise elements are added to the root.
2. **Arrange visually** by dragging elements on the canvas or using keyboard navigation for deletion.
3. **Refine properties** such as anchor points, padding, colors, and text in the Properties Editor. Color previews help pick contrasting palettes.
5. **Export** via the *Export JSON* action. Copy or download the generated TypeScript and `strings.json` files to integrate with your mod pipeline.

### Tips

- Shift + scroll to zoom
- Use **Ctrl+C / Ctrl+V** to copy and paste the currently selected element, including all nested children.
- Enable **Snap to elements** from the Side Menu whenever you need consistent spacing between siblings.
- Button elements expose extra styling controls once `Button Enabled` is switched on.
- Ensure you select the element you want to add a child to.

## 🛠️ Development scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Run the dev server with live reload. |
| `npm run build` | Produce an optimized production build in `dist/`. |

## 📁 Project structure

```
src/
	app/
		components/        # Canvas, Side Menu, and Properties Editor
		services/          # Core UI state management and export logic
	assets/bg_canvas/    # Built-in canvas background options
public/                # Static assets served at root
```

## 🤝 Contributing

Improvements, bug fixes, and new UI element types are very welcome. Please open an issue describing the change before starting on larger features so we can align on scope.
