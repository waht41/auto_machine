export const themes = {
    vscodeLight: {
        // 基础颜色
        '--vscode-foreground': '#333333',
        '--vscode-focusBorder': '#007fd4',
        '--vscode-badge-foreground': '#2c2c2c',
        '--vscode-badge-background': '#dcdcdc',

        // 下拉组件
        '--vscode-dropdown-background': '#ffffff',
        '--vscode-dropdown-foreground': '#333333',
        '--vscode-editorGroup-border': '#e7e7e7',

        // 滚动条
        '--vscode-scrollbarSlider-background': '#c8c8c8',
        '--vscode-scrollbarSlider-hoverBackground': '#a0a0a0',
        '--vscode-scrollbarSlider-activeBackground': '#787878',

        // 输入框
        '--vscode-input-background': '#ffffff',
        '--vscode-input-foreground': '#333333',
        '--vscode-input-border': '#cecece',

        // 列表
        '--vscode-list-activeSelectionBackground': '#e4e6ff',
        '--vscode-list-hoverBackground': '#f0f0f0',

        // 按钮
        '--vscode-button-background': '#007acc',
        '--vscode-button-foreground': '#ffffff',
        '--vscode-button-hoverBackground': '#0062a3',

        // 编辑器
        '--vscode-editor-background': '#fffffe',
        '--vscode-editor-foreground': '#333333',

        // 其他组件
        '--vscode-menu-background': '#ffffff',
        '--vscode-menu-foreground': '#333333',
        '--vscode-widget-shadow': '#00000026',

        // 文本链接
        '--vscode-textLink-foreground': '#006ab1',
        '--vscode-textLink-activeForeground': '#005499',
    },

    vscodeDark: {
        // 基础颜色
        '--vscode-foreground': '#cccccc',
        '--vscode-focusBorder': '#0097fb',
        '--vscode-badge-foreground': '#000000',

        // 下拉组件
        '--vscode-dropdown-background': '#2d2d2d',
        '--vscode-dropdown-foreground': '#cccccc',
        '--vscode-editorGroup-border': '#404040',

        // 滚动条
        '--vscode-scrollbarSlider-background': '#4d4d4d',
        '--vscode-scrollbarSlider-hoverBackground': '#666666',
        '--vscode-scrollbarSlider-activeBackground': '#808080',

        // 输入框
        '--vscode-input-background': '#3c3c3c',
        '--vscode-input-foreground': '#cccccc',
        '--vscode-input-border': '#5a5a5a',

        // 列表
        '--vscode-list-activeSelectionBackground': '#094771',
        '--vscode-list-hoverBackground': '#2a2d2e',

        // 按钮
        '--vscode-button-background': '#0e639c',
        '--vscode-button-foreground': '#ffffff',
        '--vscode-button-hoverBackground': '#1177bb',

        // 编辑器
        '--vscode-editor-background': '#1e1e1e',
        '--vscode-editor-foreground': '#d4d4d4',

        // 其他组件
        '--vscode-menu-background': '#252526',
        '--vscode-menu-foreground': '#cccccc',
        '--vscode-widget-shadow': '#00000059',


        // 文本链接
        '--vscode-textLink-foreground': '#3794ff',
        '--vscode-textLink-activeForeground': '#1a6dbc',
    }
} as const;

export function applyTheme(themeName: keyof typeof themes) {
    const root = document.documentElement;
    const theme = themes[themeName];

    Object.entries(theme).forEach(([varName, value]) => {
        root.style.setProperty(varName, value);
    });
}