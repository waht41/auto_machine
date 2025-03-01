import {AutoMachine} from "@core/auto-machine";
import {ApiConfiguration} from "@/shared/api";
import {buildApiHandler} from "@/api";

const config: ApiConfiguration = {
    apiProvider: 'deepseek',
    deepSeekApiKey: 'sk-6eea01cbe45e45948123560fcce2035f',
    apiModelId: 'deepseek-reasoner'
}
const am = new AutoMachine(config)
am.receiveText('Hello, how are you?')