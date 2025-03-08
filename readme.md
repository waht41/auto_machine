Auto Machine是一款借助于大模型，能够完成各类任务的桌面软件。具体可见如下gif
![auto-machine-demo](https://github.com/user-attachments/assets/29e6d2b1-4dda-4dde-a24a-f1d80564d960)


本项目基于[Roo Code](https://github.com/RooVetGit/Roo-Code/tree/main)开发，在roo code的基础之上主要做了两个重要改动

1. 将软件改为基于electron的桌面软件，不再依赖于vscode环境。
2. 优化prompt处理方式。
   1. 不会在对话开始就传递近万token的prompt，转而只传递少量介绍基本工具，以及各类工具索引的token
   2. 使用yaml作为人与AI的交流语言，更方便人和AI阅读



目前来说，auto machine处于早期阶段，各项功能并未进行充分测试，所以还未发布release包，不过有兴趣的可以执行 npm run release 自行获取release包。

但与此同时，本软件仍保留roo的核心功能

1. 大模型API适配，如openai，claude，deepseek等，用户可使用自己的API和模型提供厂商对话，没有第三方介入。
2. 权限管理，对于未授权的指令需要手动确认后才会执行。
3. MCP支持，用户可参考roo的使用方法自行添加mcp
4. 其他操作，如文件操作，浏览器操作等。

接下来的目标

- [ ] bug修复，包括clineProvider接受、发送事件的代码重构，cline stream message的代码重构等
- [ ] 寻找应用场景，并为其进行专项适配，提高agent成功率
- [ ] sub task功能，AI可以开启子任务，进一步降低token使用数量
