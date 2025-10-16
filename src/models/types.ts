export enum UIAnchor {
    BottomCenter,
    BottomLeft,
    BottomRight,
    Center,
    CenterLeft,
    CenterRight,
    TopCenter,
    TopLeft,
    TopRight,
}
export enum UIBgFill {
    Blur,
    GradientBottom,
    GradientLeft,
    GradientRight,
    GradientTop,
    None,
    OutlineThick,
    OutlineThin,
    Solid,
}
export enum UIButtonEvent {
    ButtonDown,
    ButtonUp,
    FocusIn,
    FocusOut,
    HoverIn,
    HoverOut,
}
export enum UIDepth {
    AboveGameUI,
    BelowGameUI,
}
export enum UIImageType {
    CrownOutline,
    CrownSolid,
    None,
    QuestionMark,
    RifleAmmo,
    SelfHeal,
    SpawnBeacon,
    TEMP_PortalIcon,
}

export type UIElementTypes = 'Container' | 'Text' | 'Image' | 'Button';

type UIVector = number[];

export interface UIParams {
    parent: any;

    name: string;
    type: UIElementTypes;
    position: number[];
    size: number[];
    anchor: UIAnchor;
    visible: boolean;
    textLabel: string;
    textColor: UIVector;
    textAlpha: number;
    textSize: number;
    textAnchor: UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: UIBgFill;
    imageType: UIImageType;
    imageColor: UIVector;
    imageAlpha: number;
    children?: UIParams[];
    buttonEnabled: boolean;
    buttonColorBase: UIVector;
    buttonAlphaBase: number;
    buttonColorDisabled: UIVector;
    buttonAlphaDisabled: number;
    buttonColorPressed: UIVector;
    buttonAlphaPressed: number;
    buttonColorHover: UIVector;
    buttonAlphaHover: number;
    buttonColorFocused: UIVector;
    buttonAlphaFocused: number;
}

// Extended interface for internal use with ID and selection
export interface UIElement extends UIParams {
    id: string;
    children?: UIElement[];
}

// Default values for new elements
export const DEFAULT_UI_PARAMS: Partial<UIParams> = {
    parent: null,

    position: [0, 0],
    size: [100, 50],
    anchor: UIAnchor.TopLeft,
    visible: true,
    textLabel: '',
    textColor: [1, 1, 1],
    textAlpha: 1,
    textSize: 12,
    textAnchor: UIAnchor.Center,
    padding: 0,
    bgColor: [0.2, 0.2, 0.2],
    bgAlpha: 1,
    bgFill: UIBgFill.Solid,
    imageType: UIImageType.None,
    imageColor: [1, 1, 1],
    imageAlpha: 1,
    buttonEnabled: false,
    buttonColorBase: [0.3, 0.3, 0.3],
    buttonAlphaBase: 1,
    buttonColorDisabled: [0.1, 0.1, 0.1],
    buttonAlphaDisabled: 0.5,
    buttonColorPressed: [0.2, 0.2, 0.2],
    buttonAlphaPressed: 1,
    buttonColorHover: [0.4, 0.4, 0.4],
    buttonAlphaHover: 1,
    buttonColorFocused: [0.5, 0.5, 0.5],
    buttonAlphaFocused: 1,
};

export type CanvasBackgroundMode = 'black' | 'white' | 'image';

export interface CanvasBackgroundAsset {
    id: string;
    label: string;
    fileName: string;
    url: string;
    source?: 'default' | 'upload' | 'custom';
}