# Advanced Preset Templates

This directory contains TypeScript template files for advanced preset export generators.

## Overview

Template files allow you to write the generated TypeScript code in actual `.ts` files that are then correctly serialized when generating UIs.

## How It Works

1. **Template Files**: Write your widget class in a `.template.ts` file using placeholder syntax `{{PLACEHOLDER_NAME}}`
2. **Build Process**: Template files are excluded from TypeScript compilation but copied as-is to `dist/templates/`
3. **Runtime Loading**: Export generators use `loadTemplate()` to fetch templates and `replacePlaceholders()` to substitute values

## Available Placeholders

Common placeholders you can use in your templates:

- `{{CLASS_NAME}}` - The unique class name for this widget instance
- `{{TIMESTAMP}}` - ISO timestamp for generation comment headers
- `{{UI_PARAMS}}` - Serialized UIParams for `modlib.ParseUI()`

You can define custom placeholders specific to your preset needs.

## Common Interface (Documentation Only)

The `common-interface.ts` file documents the expected interface for all generated widgets:
- `create()` - Creates and initializes the widget
- `update()` - Updates widget state
- `destroy()` - Cleanup (optional)

This file is for reference only and is not compiled or exported.
It's also expected to expose as public properties the important widget instances for easier manipulation.

## Adding New Templates

1. Create a new `.template.ts` file in this directory
2. Write your widget class using placeholder syntax
3. Create an export generator class that loads and uses your template
4. Register the preset in `registry.ts`

## File Naming Convention

- Use `.template.ts` extension for actual template files
- Templates will be copied to `dist/templates/` during build
- Use descriptive names: `[preset-name].widget.template.ts`
