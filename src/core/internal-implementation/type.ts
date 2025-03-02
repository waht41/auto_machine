import { type Cline } from "@core/Cline";

export interface IInternalContext{
    cline: Cline;
    replacing?: boolean;
    approval?: boolean;
}

export type IBaseCommand = {type:'base'} & ({
    cmd: 'log';
    title: string;
    content: string;
} | {
    cmd: 'think'; //某些思考模型自带的，模型不会主动调用
    content: string;
})

export type IAskCommand = {type:'ask'; uuid: string, result?: string} & ({
    askType: 'followup';
    question: string;
} | {
    askType: 'choice';
    question: string;
    choices: string[];
} | {
    askType: 'multiple_choice';
    question: string;
    choices: string[];
} | {
    askType: 'attempt_completion';
    question: string;
})

export type IAskApprovalCommand = {
    type: 'askApproval';
    content: any;
}

export type IApprovalCommand = {
    type: 'approval';
    content: any;
}