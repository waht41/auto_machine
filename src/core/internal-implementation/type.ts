import { type Cline } from "@core/Cline";

export interface IInternalContext{
    cline: Cline;
    replacing?: boolean;
}