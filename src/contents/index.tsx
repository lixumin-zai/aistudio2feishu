import type { PlasmoCSConfig } from "plasmo"
// 引入飞书SDK
import { GetTenantAccessToken, UploadFeishu } from '../api/feishuSDK'

export const config: PlasmoCSConfig = {
  matches: ["https://aistudio.google.com/*"],
  all_frames: false
}

// 定义对话数据接口
interface ConversationTurn {
  role: 'user' | 'model'
  content: string
}

interface ConversationData {
  turns: ConversationTurn[],
  title: string,
  timestamp: number
}

// 飞书配置接口
interface FeishuConfig {
  appId: string
  appSecret: string
  objToken: string
}

// 增加配置缓存，避免每次点击都重新读取存储
let cachedFeishuConfig: FeishuConfig | null = null

// 初始化配置监听：当 popup 保存时，contents 侧自动更新缓存
async function initFeishuConfigWatcher() {
  try {
    cachedFeishuConfig = await getFeishuConfig()
    console.log('[aistudio2feishu] 初始化配置缓存: ', { appId: cachedFeishuConfig?.appId, objToken: cachedFeishuConfig?.objToken })
  } catch (e) {
    console.log('[aistudio2feishu] 初始化配置缓存失败:', e)
  }
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' || areaName === 'sync') {
      const keys = ['feishu_app_id','feishu_app_secret','feishu_obj_token']
      const hasAny = keys.some((k) => k in changes)
      if (hasAny) {
        getFeishuConfig().then((cfg) => {
          cachedFeishuConfig = cfg
          console.log('[aistudio2feishu] 存储变化，更新配置缓存: ', { appId: cfg?.appId, objToken: cfg?.objToken })
        })
      }
    }
  })
}

// 获取飞书配置
// 使用 chrome.storage.local 读取飞书配置（带 sync 兜底），避免与页面 localStorage 混淆
async function getFeishuConfig(): Promise<FeishuConfig | null> {
  const keys = ['feishu_app_id', 'feishu_app_secret', 'feishu_obj_token'] as const
  // 先读 local
  const localRes = await new Promise<Record<string, string>>((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res as Record<string, string>))
  })
  const appIdLocal = localRes.feishu_app_id
  const appSecretLocal = localRes.feishu_app_secret
  const objTokenLocal = localRes.feishu_obj_token

  if (appIdLocal && appSecretLocal && objTokenLocal) {
    return { appId: appIdLocal, appSecret: appSecretLocal, objToken: objTokenLocal }
  }

  // 兜底读 sync
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

// 上传数据到飞书（改为走背景脚本，避免 CORS）
async function uploadToFeishu(data: ConversationData): Promise<boolean> {
  try {
    const res = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'UPLOAD_TO_FEISHU', data }, (response) => {
        resolve(response || { ok: false, error: 'No response' })
      })
    })
    if (res.ok) {
      showNotification('上传到飞书成功！', 'success')
      return true
    } else {
      showNotification('上传到飞书失败: ' + (res.error || '未知错误'), 'error')
      return false
    }
  } catch (error: any) {
    showNotification('上传到飞书失败: ' + (error?.message || '未知错误'), 'error')
    return false
  }
}


// 手动提取执行函数
async function performExtraction(): Promise<ConversationData> {
  console.log('AI Studio manual extraction started')
  
  try {
    
    
    let title = ""
    const turns: ConversationTurn[] = []

    const titleElement = document.querySelector('h1.actions.pointer')
    if (titleElement) {
      title = titleElement.textContent?.trim() || title
    }

    console.log(title)

    const editButtons = document.querySelectorAll('button[aria-label="Edit"]')
    console.log(`Found ${editButtons.length} edit buttons`)

    for (const button of editButtons) {
      if (button instanceof HTMLElement) {
        try{
          // 1. 滚动到按钮位置, 且按钮位置在最上边
          button.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'start' })
          // 2. 点击Edit按钮
          button.click()
          console.log('Clicked edit button')
          // 3. 等待一段时间让编辑模式生效
          await new Promise(resolve => setTimeout(resolve, 1000))
              
          // 4. 通过button 找到 父节点
          const parentElement = button.parentElement.parentElement.parentElement

          // 5. 获取角色信息
          const roleElement = parentElement.querySelector('[data-turn-role]')
          const role = roleElement?.getAttribute('data-turn-role')

          // 6. 提取对话数据   
          const textareaElement = parentElement.querySelector('ms-autosize-textarea')
          let content = textareaElement?.getAttribute('data-value') || ''
          console.log(content)
          if (content.trim()) {
            turns.push({
              role: role.toLowerCase() === 'user' ? 'user' : 'model',
              content: content.trim()
            })
          }
          await new Promise(resolve => setTimeout(resolve, 200))
          button.click()
          console.log('提取完成')
        } catch (error) {
          console.error('Error in extraction:', error)
        }
      }
    }
    
    return {
      turns,
      title,
      timestamp: Date.now()
    }
    
  } catch (error) {
    console.error('Error in extraction:', error)
    return { turns: [], title: 'AI Studio Conversation', timestamp: Date.now() }
  }
}

// 创建通知弹窗
function showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  // 移除已存在的通知
  const existingNotification = document.getElementById('aistudio-notification')
  if (existingNotification) {
    existingNotification.remove()
  }

  const notification = document.createElement('div')
  notification.id = 'aistudio-notification'
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `

  // 根据类型设置不同的背景色
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#10b981'
      break
    case 'error':
      notification.style.backgroundColor = '#ef4444'
      break
    case 'warning':
      notification.style.backgroundColor = '#f59e0b'
      break
  }

  notification.textContent = message
  document.body.appendChild(notification)

  // 3秒后自动消失
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0'
      notification.style.transform = 'translateX(100%)'
      setTimeout(() => {
        notification.remove()
      }, 300)
    }
  }, 3000)
}

// 创建浮动按钮
function createFloatingButton() {
  // 移除已存在的按钮
  const existingUploadButton = document.getElementById('aistudio-upload-button')

  if (existingUploadButton) {
    existingUploadButton.remove()
  }

  // 创建提取并上传按钮
  const uploadButton = document.createElement('button')
  uploadButton.id = 'aistudio-upload-button'
  uploadButton.textContent = '提取并上传'
  uploadButton.style.cssText = `
    position: fixed;
    top: 130px;
    right: 20px;
    width: 100px;
    height: 40px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  `


  // 上传按钮悬停效果
  uploadButton.addEventListener('mouseenter', () => {
    uploadButton.style.transform = 'translateY(-2px)'
    uploadButton.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)'
  })

  uploadButton.addEventListener('mouseleave', () => {
    uploadButton.style.transform = 'translateY(0)'
    uploadButton.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)'
  })

  // 上传按钮点击事件
  uploadButton.addEventListener('click', async () => {
    uploadButton.disabled = true
    uploadButton.textContent = '提取中...'
    uploadButton.style.opacity = '0.7'

    try {
      const data = await performExtraction()
      if (data.turns && data.turns.length > 0) {
        showNotification(`成功提取 ${data.turns.length} 条对话`, 'success')
        
        // 检查是否配置了飞书信息（优先使用缓存）
        const config = cachedFeishuConfig || await getFeishuConfig()
        console.log('[aistudio2feishu] 获取到配置: ', { appId: config?.appId, appSecret: config?.appSecret, objToken: config?.objToken, chromeAvailable: !!(window as any).chrome?.storage })
        if (config) {
          showNotification(`已读取配置: AppID=${config.appId}, ObjToken=${config.objToken}`, 'warning')
          uploadButton.textContent = '上传中...'
          const uploadSuccess = await uploadToFeishu(data)
          if (uploadSuccess) {
            uploadButton.textContent = '上传成功'
            setTimeout(() => {
              uploadButton.textContent = '提取并上传'
            }, 2000)
          }
        } else {
          showNotification('请先在插件弹窗中配置飞书信息', 'warning')
        }
      } else {
        showNotification('未找到对话内容', 'warning')
      }
    } catch (error) {
      console.error('提取失败:', error)
      showNotification('提取失败: ' + (error.message || '未知错误'), 'error')
    } finally {
      uploadButton.disabled = false
      if (uploadButton.textContent !== '上传成功') {
        uploadButton.textContent = '提取并上传'
      }
      uploadButton.style.opacity = '1'
    }
  })

  document.body.appendChild(uploadButton)
}

// Content script加载完成
console.log('AI Studio content script loaded and ready', { chromeAvailable: !!(window as any).chrome?.storage })
initFeishuConfigWatcher()

// 页面加载完成后创建按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingButton)
} else {
  createFloatingButton()
}

// 监听页面变化，确保按钮始终存在
const observer = new MutationObserver(() => {
  if (!document.getElementById('aistudio-upload-button')) {
    createFloatingButton()
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONVERSATION_DATA') {
    return true // 保持消息通道开放
  } else if (message.type === 'EXTRACT_DATA') {
    console.log('AI Studio content script received EXTRACT_DATA message')
    performExtraction().then(data => {
      console.log("提取到的数据:", data)
      sendResponse(data)
    }).catch(error => {
      console.error('提取失败:', error)
      sendResponse({ turns: [], timestamp: Date.now(), error: error.message })
    })
    return true // 保持消息通道开放
  }
  
  return false // 对于其他消息类型，不保持通道开放
})