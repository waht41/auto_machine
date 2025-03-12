import React, { useState, useEffect, useRef, useMemo } from 'react';

// 类型定义增强
type Primitive = string | number;
type OptionItem = Primitive | { value: Primitive; label: React.ReactNode };

interface ASelectProps {
    value?: Primitive | Primitive[];
    onChange?: (value: any) => void;
    options?: OptionItem[];
    title?: string;
    onConfirm?: (value: any) => void;
    onCancel?: () => void;
    mode?: 'single' | 'multiple';
    result?: string
}

// 标准化选项格式
const normalizeOptions = (options: OptionItem[] = []) => {
	return options.map(option => {
		if (typeof option === 'object' && 'value' in option) {
			return option;
		}
		return {value: option, label: option.toString()};
	});
};

const ASelect = (
	{
		value: externalValue,
		options = [],
		title,
		mode = 'single',
		onConfirm,
		onCancel,
		result
	}: ASelectProps) => {
	const [innerValue, setInnerValue] = useState(externalValue);

	// 标准化后的选项
	const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

	// 同步外部值
	useEffect(() => {
		setInnerValue(externalValue);
	}, [externalValue]);

	return (
		<div style={{display: 'flex', flexDirection: 'column'}}>
			<div>{title}</div>
			<select
				multiple={mode === 'multiple'}
				onChange={(e) => {
					if (mode === 'multiple') {
						const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
						setInnerValue(selectedOptions);
					} else {
						setInnerValue(e.target.value);
					}
				}}
			>
				{normalizedOptions.map(option => (
					<option
						key={option.value}
						value={option.value}
					>
						{option.label}
					</option>
				))}
			</select>
			{result?
				<div>You have chose {result}</div>
				:<div>
					<button onClick={() => onConfirm?.(innerValue)}>confirm</button>
					<button onClick={onCancel}>cancel</button>
				</div>
			}
		</div>
	);
};

export default ASelect;
