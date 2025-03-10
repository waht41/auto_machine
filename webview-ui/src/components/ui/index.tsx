import React from 'react';
import { 
    Checkbox as AntCheckbox,
    Collapse
} from "antd";

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
        <span style={{ display: 'flex', alignItems: 'center' }}>
            <AntCheckbox
                checked={checked}
                onChange={(e) => onChange?.(e.target.checked)}
                {...props}
            />
            {label && <span style={{ marginLeft: '8px' }}>{label}</span>}
        </span>
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
    onChange?: (value: {value: string}) => void;
    [key: string]: any;
}) => {
    return (
        <select
            className="dropdown"
            value={value}
            onChange={(e) => {
                console.log('[waht] select',e.target.value)
                onChange?.(e.target)
            }}
            {...props}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
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
        <Collapse {...props}>
            <Collapse.Panel header="" key="1">
                {children}
            </Collapse.Panel>
        </Collapse>
    );
};
