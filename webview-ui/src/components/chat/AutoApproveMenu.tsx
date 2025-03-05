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

const BodyContainer = styled.div``;

const Description = styled.div`
  color: #687076;
  font-size: 12px;
`;

const StyledHeaderTreeSelect = styled(TreeSelect)`
  width: 400px;
  margin-right: 8px;
  flex: 1;
  && .ant-select-selection-overflow {
    width: 100%;
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
  )
}

interface MenuHeaderProps {
  allowedTools: string[]
  tools: IToolCategory[]
  setAllowedTools: (toolId: string[]) => void
}

const MenuHeader = ({ allowedTools, tools, setAllowedTools }: MenuHeaderProps) => {
  // 阻止事件冒泡，防止点击 TreeSelect 时触发 HeaderContainer 的点击事件
  const convertedTools = useMemo(() => convertToNodes(tools), [tools]);

  return (
    <HeaderContainer>
      <HeaderContent>
        <HeaderTitle>Auto-approve:</HeaderTitle>
          <StyledHeaderTreeSelect
            treeData={convertedTools}
            value={allowedTools}
            onChange={(checked) => {
              setAllowedTools(checked);
            }}
            treeCheckable={true}
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="click here to choose tools"
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            treeDefaultExpandAll
            treeNodeLabelProp="title"
          />
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

const MenuBody = () => {
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
