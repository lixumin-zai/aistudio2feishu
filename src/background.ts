// Service Worker (MV3) - Proxy Feishu API calls to avoid CORS issues from content scripts
// This file runs in the extension background context which has cross-origin fetch privileges

import { GetTenantAccessToken, UploadFeishu } from "./api/feishuSDK"

// Types kept minimal to avoid cross-file imports
interface ConversationTurn {
  role: "user" | "model"
  content: string
}

interface ConversationData {
  turns: ConversationTurn[]
  title: string
  timestamp: number
}

interface FeishuConfig {
  appId: string
  appSecret: string
  objToken: string
}

// Read Feishu config from chrome.storage (local preferred, sync fallback)
async function getFeishuConfig(): Promise<FeishuConfig | null> {
  const keys = ["feishu_app_id", "feishu_app_secret", "feishu_obj_token"] as const
  const localRes = await new Promise<Record<string, string>>((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res as Record<string, string>))
  })
  const appIdLocal = localRes.feishu_app_id
  const appSecretLocal = localRes.feishu_app_secret
  const objTokenLocal = localRes.feishu_obj_token
  if (appIdLocal && appSecretLocal && objTokenLocal) {
    return { appId: appIdLocal, appSecret: appSecretLocal, objToken: objTokenLocal }
  }
  const syncRes = await new Promise<Record<string, string>>((resolve) => {
    chrome.storage.sync.get(keys, (res) => resolve(res as Record<string, string>))
  })
  const appIdSync = syncRes.feishu_app_id
  const appSecretSync = syncRes.feishu_app_secret
  const objTokenSync = syncRes.feishu_obj_token
  if (appIdSync && appSecretSync && objTokenSync) {
    return { appId: appIdSync, appSecret: appSecretSync, objToken: objTokenSync }
  }
  return null
}

async function uploadToFeishuInBackground(data: ConversationData): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getFeishuConfig()
    if (!config) {
      return { ok: false, error: "未配置飞书信息" }
    }
    const uploadFeishu = new UploadFeishu()
    const getTenantAccessToken = new GetTenantAccessToken(config.appId, config.appSecret)

    const accessToken = await getTenantAccessToken.call()
    if (!accessToken) {
      return { ok: false, error: "获取飞书访问令牌失败，请检查App ID和App Secret" }
    }

    const obj_token = await uploadFeishu.createDocx(accessToken, config.objToken, data.title)
    if (!obj_token) {
      return { ok: false, error: "创建飞书文档失败" }
    }

    let markdown_text = ""
    for (const item of data.turns) {
      markdown_text += `---\n${item.content}\n---\n`
    }

    const [docx_block, first_level_block_ids] = await uploadFeishu.markdown2docx(accessToken, markdown_text)
    const uploadData = {
      index: 0,
      children_id: first_level_block_ids,
      descendants: docx_block
    }

    const isSuccess = await uploadFeishu.blockUpload(accessToken, obj_token, obj_token, uploadData as any)
    if (isSuccess) {
      return { ok: true }
    }
    return { ok: false, error: "上传到飞书失败" }
  } catch (e: any) {
    return { ok: false, error: e?.message || "未知错误" }
  }
}

// Message router
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "UPLOAD_TO_FEISHU") {
    const data = message?.data as ConversationData
    uploadToFeishuInBackground(data)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || "未知错误" }))
    return true // keep channel open for async response
  }
  return false
})