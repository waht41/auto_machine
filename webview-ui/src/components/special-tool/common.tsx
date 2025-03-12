// 通用样式
export const headerStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	marginBottom: '8px',
};

// 工具图标组件
export const toolIcon = (type: string) => {
	// 这里可以实现图标的逻辑
	return <span className={`tool-icon ${type}`}></span>;
};