import React, { memo, useState } from 'react';
import MarkdownBlock from '@webview-ui/components/common/MarkdownBlock';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

export const Markdown = memo(({ markdown, partial }: { markdown?: string; partial?: boolean }) => {
	const [isHovering, setIsHovering] = useState(false);

	return (
		<div
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			style={{ position: 'relative' }}>
			<div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', marginBottom: -15, marginTop: -15 }}>
				<MarkdownBlock markdown={markdown} />
			</div>
			{markdown && !partial && isHovering && (
				<div
					style={{
						position: 'absolute',
						bottom: '-4px',
						right: '8px',
						opacity: 0,
						animation: 'fadeIn 0.2s ease-in-out forwards',
						borderRadius: '4px'
					}}>
					<style>
						{`
							@keyframes fadeIn {
								from { opacity: 0; }
								to { opacity: 1.0; }
							}
						`}
					</style>
					<VSCodeButton
						className="copy-button"
						appearance="icon"
						style={{
							height: '24px',
							border: 'none',
							background: 'var(--vscode-editor-background)',
							transition: 'background 0.2s ease-in-out'
						}}
						onClick={() => {
							navigator.clipboard.writeText(markdown);
							// Flash the button background briefly to indicate success
							const button = document.activeElement as HTMLElement;
							if (button) {
								button.style.background = 'var(--vscode-button-background)';
								setTimeout(() => {
									button.style.background = '';
								}, 200);
							}
						}}
						title="Copy as markdown">
						<span className="codicon codicon-copy"></span>
					</VSCodeButton>
				</div>
			)}
		</div>
	);
}, (prevProps, nextProps) => {
	// 只有当 markdown 内容或 partial 状态变化时才重新渲染
	return prevProps.markdown === nextProps.markdown && prevProps.partial === nextProps.partial;
});