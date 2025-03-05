import { IToolCategory, IToolNode } from "@core/tool-adapter/type";

export class AllowedToolTree {
  private readonly commands: Set<string>;
  private nodesMap: Map<string, IToolNode>;

  constructor(
    allowedCommands: string[],
    private readonly categories: IToolCategory[]
  ) {
    this.commands = new Set(allowedCommands);
    this.nodesMap = new Map();
    this.buildNodesMap(categories);
  }

  toggle(toolIds: string | string[]): string[] {
    const ids = Array.isArray(toolIds) ? toolIds : [toolIds];
    ids.forEach(toolId => {
      if (this.commands.has(toolId)) {
        this.removeTool(toolId);
      } else {
        this.addTool(toolId);
      }
    });
    return Array.from(this.commands);
  }

  isAllowed(toolId: string): boolean {
    let currentId: string | null = toolId;

    while (currentId !== null) {
      if (this.commands.has(currentId)) {
        return true;
      }
      currentId = this.getParentId(currentId);
    }
    return false;
  }

  getAllowedTools(): string[] {
    return Array.from(this.commands);
  }

  private addTool(toolId: string) {
    this.removeAncestorParents(toolId);
    this.removeDescendantChildren(toolId);
    this.commands.add(toolId);
    this.tryMergeParent(toolId);
  }

  private removeTool(toolId: string) {
    this.commands.delete(toolId);
  }

  private removeAncestorParents(toolId: string) {
    let parentId = this.getParentId(toolId);
    while (parentId) {
      this.commands.delete(parentId);
      parentId = this.getParentId(parentId);
    }
  }

  private removeDescendantChildren(toolId: string) {
    for (const childId of this.getAllDescendantIds(toolId)) {
      this.commands.delete(childId);
    }
  }

  private tryMergeParent(currentId: string) {
    let parentId = this.getParentId(currentId);

    while (parentId) {
      const requiredChildren = this.getDirectChildIds(parentId);
      const hasAllChildren = requiredChildren.every(id =>
        this.commands.has(id)
      );

      if (hasAllChildren) {
        requiredChildren.forEach(id => this.commands.delete(id));
        this.commands.add(parentId);
        currentId = parentId;
        parentId = this.getParentId(currentId);
      } else {
        break;
      }
    }
  }

  private getParentId(toolId: string): string | null {
    const parts = toolId.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : null;
  }

  private getDirectChildIds(parentId: string): string[] {
    const node = this.findNode(parentId);
    return node && 'tools' in node ?
      node.tools.map(t => t.id) :
      [];
  }

  private getAllDescendantIds(toolId: string): string[] {
    const node = this.findNode(toolId);
    return node ? this.collectChildIds(node) : [];
  }

  private collectChildIds(node: IToolNode): string[] {
    if ('tools' in node) {
      return node.tools.flatMap(child => this.collectChildIds(child));
    }
    return [node.id];
  }

  private findNode(targetId: string): IToolNode | undefined {
    return this.nodesMap.get(targetId);
  }

  private buildNodesMap(nodes: IToolNode[]): void {
    nodes.forEach(node => {
      this.nodesMap.set(node.id, node);
      if ('tools' in node) {
        this.buildNodesMap(node.tools);
      }
    });
  }
}
