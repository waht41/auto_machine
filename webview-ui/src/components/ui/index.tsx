import React from 'react';
import { 
    VSCodeCheckbox, 
    VSCodeDropdown, 
    VSCodePanels
} from "@vscode/webview-ui-toolkit/react";

// 重新封装Checkbox组件，保持与vscrui的API一致
export const Checkbox = ({ 
    checked, 
    onChange, 
    label,
    ...props 
}: { 
    checked?: boolean; 
    onChange?: (checked: boolean) => void;
    label?: string;
    [key: string]: any;
}) => {
    return (
        <VSCodeCheckbox
            checked={checked}
            onChange={(e) => onChange?.(e.target?.checked)}
            {...props}
        >
            {label}
        </VSCodeCheckbox>
    );
};

// 重新封装Dropdown组件，保持与vscrui的API一致
export const Dropdown = ({ 
    options = [], 
    value, 
    onChange,
    ...props 
}: { 
    options?: Array<{ value: string; label: string }>; 
    value?: string;
    onChange?: (value: string) => void;
    [key: string]: any;
}) => {
    return (
        <VSCodeDropdown
            value={value}
            onChange={(e) => onChange?.(e?.target?.value)}
            {...props}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </VSCodeDropdown>
    );
};

// 重新封装Pane组件，保持与vscrui的API一致
export const Pane = ({ 
    children,
    ...props 
}: { 
    children?: React.ReactNode;
    [key: string]: any;
}) => {
    return (
        <VSCodePanels {...props}>
            {children}
        </VSCodePanels>
    );
};
