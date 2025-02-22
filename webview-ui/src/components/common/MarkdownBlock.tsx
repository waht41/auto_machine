import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import styled from "styled-components";
// 导入暗色主题
import 'highlight.js/styles/atom-one-dark.css';
import yaml from 'highlight.js/lib/languages/yaml';

interface MarkdownBlockProps {
	markdown?: string;
	className?: string;
}

const Container = styled.div`
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, serif;
	line-height: 1.6;
	color: ${({ theme }) => theme.textColor || '#333'};

	p {
		margin: 0.8em 0;
	}

	pre {
		background: ${({ theme }) => theme.codeBg || '#282c34'};
		border-radius: 6px;
		padding: 1.2em;
		overflow-x: auto;
		margin: 1em 0;

		code {
			font-family: 'Fira Code', monospace;
			font-size: 14px;
			color: ${({ theme }) => theme.codeColor || '#abb2bf'};
		}
	}

	code {
		font-family: 'Fira Code', monospace;
		font-size: 14px;
		padding: 0.2em 0.4em;
		border-radius: 3px;
		background: ${({ theme }) => theme.inlineCodeBg || 'rgba(40, 44, 52, 0.05)'};
	}

	a {
		color: ${({ theme }) => theme.linkColor || '#0366d6'};
		text-decoration: none;
		&:hover {
			text-decoration: underline;
		}
	}
`;

// 自定义链接组件
const CustomLink = (props: any) => {
	const href = props.href;
	const isExternal = href?.startsWith('http');
	return (
		<a
			href={href}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			{...props}
		>
			{props.children}
		</a>
	);
};

const MarkdownBlock = memo(({ markdown = "", className }: MarkdownBlockProps) => {
	return (
		<Container className={className}>
			<ReactMarkdown
				components={{
					a: CustomLink
				}}
				rehypePlugins={[
					[rehypeHighlight, {
						languages: {
							yaml
						},
					} as any]
				]}
			>
				{markdown}
			</ReactMarkdown>
		</Container>
	);
});

MarkdownBlock.displayName = "MarkdownBlock";

export default MarkdownBlock;
