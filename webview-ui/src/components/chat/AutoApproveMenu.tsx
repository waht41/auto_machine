import { useMemo, useState } from 'react';
import { IToolCategory, IToolNode } from '@core/tool-adapter/type';
import styled from 'styled-components';
import { Tooltip, Button, Popover, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { ReactComponent as ApprovalIcon } from '@webview-ui/assets/approvalIcon.svg';
import { colors } from '../common/styles';
import SVGComponent from '@webview-ui/components/common/SVGComponent';

// 使用styled-components定义样式组件
const Container = styled.div`
  margin-left: 10px;
  user-select: none;
`;

const MenuContainer = styled.div``;

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
`;

const HeaderTitle = styled.span`
  color: #11181C;
  flex-shrink: 0;
  font-weight: 500;
  margin-right: 8px;
`;

const BodyContainer = styled.div``;

const Description = styled.div`
  color: #687076;
  font-size: 12px;
`;

const PopoverTitle = styled.div`
  font-size: 20px;
  color: ${colors.textPrimary};
`;

const PopoverDescription = styled.p`
  color: ${colors.textSecondary};
`;

// 自定义Tree样式，修改checkbox背景色为primary
const StyledTree = styled(Tree)`
  .ant-tree-checkbox-checked .ant-tree-checkbox-inner {
    background-color: ${colors.primary};
    border-color: ${colors.primary};
  }
  
  .ant-tree-checkbox-indeterminate .ant-tree-checkbox-inner::after {
    background-color: ${colors.primary} !important;
  }
  
  .ant-tree-checkbox-wrapper:hover .ant-tree-checkbox-inner,
  .ant-tree-checkbox:hover .ant-tree-checkbox-inner,
  .ant-tree-checkbox-input:focus + .ant-tree-checkbox-inner {
    border-color: ${colors.primary} !important;
	background-color: ${colors.primaryPress} !important;
  }
`;

// 创建圆形按钮组件
const CircleButton = styled(Button)`
  padding: 4px;
  &:hover {
    background-color: ${colors.primaryLight};
    border-radius: 50%;
  }
`;

const tools: IToolCategory[] = [
	{
		id: 'file',
		label: 'File',
		description: 'File permissions',
		tools: [
			{
				id: 'readFiles',
				label: 'Read files and directories',
				description: 'Allows access to read any file on your computer.',
			},
			{
				id: 'editFiles',
				label: 'Edit files',
				description: 'Allows modification of any files on your computer.',
			},
		],
	},
	{
		id: 'commands',
		label: 'Commands',
		description: 'Command permissions',
		tools: [
			{
				id: 'executeCommands',
				label: 'Execute approved commands',
				description:
          'Allows execution of approved terminal commands. You can configure this in the settings panel.',
			},
		],
	},
	{
		id: 'browser',
		label: 'Browser',
		description: 'Browser permissions',
		tools: [
			{
				id: 'useBrowser',
				label: 'Use the browser',
				description: 'Allows ability to launch and interact with any website in a headless browser.',
			},
		],
	},
	{
		id: 'mcp',
		label: 'MCP',
		description: 'MCP permissions',
		tools: [
			{
				id: 'useMcp',
				label: 'Use MCP servers',
				description: 'Allows use of configured MCP servers which may modify filesystem or interact with APIs.',
				tools: [
					{
						id: 'sql',
						label: 'SQL',
						description: 'Allows use of SQL servers.',
					}
				]
			},
		],
	},
	{
		id: 'retry',
		label: 'Retry',
		description: 'Retry permissions',
		tools: [
			{
				id: 'retryRequests',
				label: 'Retry failed requests',
				description: 'Automatically retry failed requests when the provider returns an error response.',
			},
		],
	},
];

interface IProp{
  toolCategories: IToolCategory[]
  allowedTools: string[]
  setAllowedTools: (toolId: string[]) => void
}

const AutoApproveMenu = ({toolCategories, allowedTools, setAllowedTools}:IProp) => {

	return (
		<Container>
			<MenuContainer>
				<MenuHeader allowedTools={allowedTools} tools={toolCategories || tools} setAllowedTools={setAllowedTools} />
				<MenuBody/>
			</MenuContainer>
		</Container>
	);
};

interface AutoApprovePopoverProps {
  allowedTools: string[]
  treeData: DataNode[]
  setAllowedTools: (toolId: string[]) => void
}

// 抽取的Popover组件
export const AutoApprovePopover = ({ allowedTools, treeData, setAllowedTools }: AutoApprovePopoverProps) => {
	const [open, setOpen] = useState(false);
	
	return (
		<Popover
			open={open}
			onOpenChange={setOpen}
			trigger="click"
			content={
				<div style={{ maxHeight: '50vh', overflow: 'auto', width: 400, overflowY: 'auto', overflowX: 'hidden' }}>
					<PopoverTitle>Tool Permissions</PopoverTitle>
					<PopoverDescription>Roo will use selected tools without asking each time</PopoverDescription>
					<StyledTree
						checkable
						checkedKeys={allowedTools}
						onCheck={(checkedKeys) => {
							console.log('[waht] menu header',checkedKeys);
							setAllowedTools(checkedKeys as string[]);
						}}
						treeData={treeData}
						defaultExpandAll={true}
						checkStrictly={false}
					/>
				</div>
			}
		>
			<CircleButton type="text">
				<SVGComponent component={ApprovalIcon} stroke={open? colors.primary : colors.textSecondary} width={20} height={20}/>
			</CircleButton>
		</Popover>
	);
};

interface ApprovalButtonProps {
  allowedTools: string[]
  toolCategories: IToolCategory[]
  setAllowedTools: (toolId: string[]) => void
}

export const ApprovalButton = ({ allowedTools, toolCategories, setAllowedTools }: ApprovalButtonProps) => {
	// 转换工具数据为 Tree 需要的 DataNode 结构
	const treeData = useMemo(() => {
		return convertToNodes(toolCategories);
	}, [toolCategories]);

	return (
		<AutoApprovePopover 
			allowedTools={allowedTools} 
			treeData={treeData} 
			setAllowedTools={setAllowedTools} 
		/>
	);
};

interface MenuHeaderProps {
  allowedTools: string[]
  tools: IToolCategory[]
  setAllowedTools: (toolId: string[]) => void
}

const MenuHeader = ({ allowedTools, tools, setAllowedTools }: MenuHeaderProps) => {
	return (
		<HeaderContainer>
			<HeaderContent>
				<HeaderTitle>Auto-approve:</HeaderTitle>
				<ApprovalButton 
					allowedTools={allowedTools} 
					toolCategories={tools} 
					setAllowedTools={setAllowedTools} 
				/>
			</HeaderContent>
		</HeaderContainer>
	);
};

// 判断节点是否为类别（有子工具）
const isCategory = (node: IToolNode): node is IToolCategory => {
	return 'tools' in node && Array.isArray((node as IToolCategory).tools);
};

// 将工具数据转换为 Tree 所需的节点格式
const convertToNodes = (toolCategories: IToolCategory[]): DataNode[] => {
	// 递归处理节点
	const processNode = (node: IToolNode): DataNode => {
		const processedNode: DataNode = {
			title: (
				<Tooltip title={node.description}>
					{node.label}
				</Tooltip>
			),
			key: node.id,
		};

		if (isCategory(node)) {
			processedNode.children = node.tools.map(tool => processNode(tool));
		}

		return processedNode;
	};

	// 创建一个根节点，包含所有工具类别
	return [{
		title: (
			<Tooltip title="all available tools">
        All
			</Tooltip>
		),
		key: 'all',
		children: toolCategories.map(category => processNode(category))
	}];
};

const MenuBody = () => {
	return (
		<BodyContainer>
			<Description>
        Auto-approve allows the assistant to perform actions without asking for permission.
        Only enable for actions you fully trust.
			</Description>
		</BodyContainer>
	);
};

export default AutoApproveMenu;
