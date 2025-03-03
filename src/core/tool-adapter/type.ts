export interface IToolItem {
    id: string;
    label: string;
    description: string;
}

export interface IToolCategory {
    id: string;
    label: string;
    description: string;
    tools: IToolNode[];
}

type IToolNode = IToolItem | IToolCategory;
