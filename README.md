# Aistudio2Feishu

## Description

Built with Plasmo

Extension for uploading Google AI Studio data to Feishu Docs

用于将Google AI Studio对话数据上传到飞书云文档的扩展程序，便于查看与整理
![image.png](assets/image.png)


## Usage
- 需要一个飞书应用 App ID 和 App Secret
- 开启权限
- 知识库空间文档 token [官方文档](https://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-qa)


## Project Init
```shell
# create
npm create plasmo .
# install
pnpm install
# test
npm run dev
# build
npm run build
```

## Attention
```
// tsconfig.json

"paths": {
    "~*": [
    "./src/*"
    ]
}

```

