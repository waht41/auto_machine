import { useCallback, useMemo, useState } from "react";
import { IToolCategory, IToolNode } from "@core/tool-adapter/type";
import styled from "styled-components";
import { Tooltip, TreeSelect } from "antd";

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
  cursor: pointer;
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

const ChevronIcon = styled.div`
  flex-shrink: 0;
  color: #687076;
`;

const BodyContainer = styled.div``;

const Description = styled.div`
  margin-bottom: 10px;
  color: #687076;
  font-size: 12px;
`;

const StyledHeaderTreeSelect = styled(TreeSelect)`
  width: auto;
  margin-right: 8px;
  flex: 1;
  min-width: 300px;
`;

const tools: IToolCategory[] = [
  {
    id: "file",
    label: "File",
    description: "File permissions",
    tools: [
      {
        id: "readFiles",
        label: "Read files and directories",
        description: "Allows access to read any file on your computer.",
      },
      {
        id: "editFiles",
        label: "Edit files",
        description: "Allows modification of any files on your computer.",
      },
    ],
  },
  {
    id: "commands",
    label: "Commands",
    description: "Command permissions",
    tools: [
      {
        id: "executeCommands",
        label: "Execute approved commands",
        description:
          "Allows execution of approved terminal commands. You can configure this in the settings panel.",
      },
    ],
  },
  {
    id: "browser",
    label: "Browser",
    description: "Browser permissions",
    tools: [
      {
        id: "useBrowser",
        label: "Use the browser",
        description: "Allows ability to launch and interact with any website in a headless browser.",
      },
    ],
  },
  {
    id: "mcp",
    label: "MCP",
    description: "MCP permissions",
    tools: [
      {
        id: "useMcp",
        label: "Use MCP servers",
        description: "Allows use of configured MCP servers which may modify filesystem or interact with APIs.",
        tools: [
          {
            id: "sql",
            label: "SQL",
            description: "Allows use of SQL servers.",
          }
        ]
      },
    ],
  },
  {
    id: "retry",
    label: "Retry",
    description: "Retry permissions",
    tools: [
      {
        id: "retryRequests",
        label: "Retry failed requests",
        description: "Automatically retry failed requests when the provider returns an error response.",
      },
    ],
  },
]

interface IProp{
  toolCategories: IToolCategory[]
  allowedTools: string[]
  onToggleTool: (toolId: string[]) => void
}

const AutoApproveMenu = ({toolCategories, allowedTools, onToggleTool}:IProp) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const showedAllowedTools = allowedTools.filter((toolId) => !['external','base','ask','askApproval','approval'].includes(toolId))
  console.log('[waht]','showedAllowedTools',showedAllowedTools, allowedTools)
  return (
    <Container>
      <MenuContainer>
        <MenuHeader isExpanded={isExpanded} onClick={toggleExpanded} allowedTools={showedAllowedTools} tools={toolCategories || tools} onToggleTool={onToggleTool} />
        <MenuBody
          tools={toolCategories || tools}
          allowedTools={showedAllowedTools}
          onToggleTool={onToggleTool}
        />
      </MenuContainer>
    </Container>
  )
}

interface MenuHeaderProps {
  isExpanded: boolean
  onClick: () => void
  allowedTools: string[]
  tools: IToolCategory[]
  onToggleTool: (toolId: string[]) => void
}

const MenuHeader = ({ isExpanded, onClick, allowedTools, tools, onToggleTool }: MenuHeaderProps) => {
  // 阻止事件冒泡，防止点击 TreeSelect 时触发 HeaderContainer 的点击事件
  const handleTreeSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  const convertedTools = useMemo(() => convertToNodes(tools), [tools]);

  return (
    <HeaderContainer onClick={onClick}>
      <HeaderContent>
        <HeaderTitle>Auto-approve:</HeaderTitle>
        <div onClick={handleTreeSelectClick}>
          <StyledHeaderTreeSelect
            treeData={convertedTools}
            value={allowedTools}
            onChange={(checked) => {
              // 找出所有不同的元素
              let diffs: string[] = [];

              if (Array.isArray(checked) && checked.length > allowedTools.length) {
                // 新增的元素：在 checked 中但不在 allowedTools 中
                diffs = checked.filter(id => !allowedTools.includes(id));
              } else {
                // 移除的元素：在 allowedTools 中但不在 checked 中
                diffs = allowedTools.filter(id => !checked.includes(id));
              }

              console.log('[waht]','diffs',diffs);
              console.log('[waht]','checked',checked);

              if (diffs.length > 0) {
                // 将所有差异元素传递给 onToggleTool
                onToggleTool(diffs);
              }
            }}
            treeCheckable={true}
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="请选择工具"
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeDefaultExpandAll
            treeNodeLabelProp="title"
          />
        </div>
        {isExpanded ? (
          <ChevronIcon>&#x25BC;</ChevronIcon>
        ) : (
          <ChevronIcon>&#x25B6;</ChevronIcon>
        )}
      </HeaderContent>
    </HeaderContainer>
  );
}

// 判断节点是否为类别（有子工具）
const isCategory = (node: IToolNode): node is IToolCategory => {
  return 'tools' in node && Array.isArray((node as IToolCategory).tools);
};

// 将工具数据转换为 TreeSelect 所需的节点格式
const convertToNodes = (toolCategories: IToolCategory[]): any[] => {
  // 递归处理节点
  const processNode = (node: IToolNode): any => {
    const processedNode: any = {
      title: (
        <Tooltip title={node.description}>
          {node.label}
        </Tooltip>
      ),
      value: node.id,
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
      <Tooltip title="所有可用的自动批准工具">
        所有工具
      </Tooltip>
    ),
    value: "all",
    key: "all",
    children: toolCategories.map(category => processNode(category))
  }];
};

interface MenuBodyProps {
  tools: IToolCategory[]
  allowedTools: string[]
  onToggleTool: (toolId: string[]) => void
}

const MenuBody = ({ tools, allowedTools, onToggleTool }: MenuBodyProps) => {
  return (
    <BodyContainer>
      <Description>
        Auto-approve allows the assistant to perform actions without asking for permission.
        Only enable for actions you fully trust.
      </Description>
    </BodyContainer>
  );
}

export default AutoApproveMenu;
