# Aistudio2Feishu

## Description

Built with Plasmo

Extension for uploading Google AI Studio chat data to Feishu Wiki Docs

用于将Google AI Studio对话数据上传到飞书云知识库文档的扩展程序，便于查看、整理和导出

<div align="center">
<img src="assets/image.png" alt="Product showcase" width="40%" />
</div>

## Usage
- 需要一个飞书应用 App ID 和 App Secret
- 开启权限 [官方文档](https://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-qa)
- 知识库空间文档 obj_token 

## Project Init
```shell
# create
# npm create plasmo .
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

