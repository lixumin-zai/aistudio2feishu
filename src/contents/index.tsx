import type { PlasmoCSConfig } from "plasmo"

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
  turns: ConversationTurn[]
  timestamp: number
}

// 等待元素出现的工具函数
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // 超时处理
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

// 自动点击Edit按钮
async function clickEditButtons(): Promise<void> {
  try {
    const editButtons = document.querySelectorAll('button[aria-label="Edit"]')
    console.log(`Found ${editButtons.length} edit buttons`)
    
    for (const button of editButtons) {
      if (button instanceof HTMLElement) {
        button.click()
        console.log('Clicked edit button')
        // 等待一下让页面响应
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  } catch (error) {
    console.error('Error clicking edit buttons:', error)
  }
}

// 提取对话内容
function extractConversationData(): ConversationData {
  const turns: ConversationTurn[] = []
  
  try {
    // 查找所有的对话容器
    const promptContainers = document.querySelectorAll('ms-chat-turn')
    console.log(`Found ${promptContainers.length} prompt containers`)
    
    promptContainers.forEach((container, index) => {
      try {
        // 获取角色信息
        const roleElement = container.querySelector('[data-turn-role]')
        const role = roleElement?.getAttribute('data-turn-role')

        if (!role || (role !== 'User' && role !== 'Model')) {
          console.warn(`Invalid or missing role for container ${index}:`, role)
          return
        }
        
        // 获取文本内容
        const textareaElement = container.querySelector('ms-autosize-textarea')
        const content = textareaElement?.getAttribute('data-value') || ''
        
        if (content.trim()) {
          turns.push({
            role: role as 'user' | 'model',
            content: content.trim()
          })
          console.log(`Extracted ${role} message:`, content.substring(0, 100) + '...')
        }
      } catch (error) {
        console.error(`Error processing container ${index}:`, error)
      }
    })
  } catch (error) {
    console.error('Error extracting conversation data:', error)
  }
  
  return {
    turns,
    timestamp: Date.now()
  }
}

// 将数据发送到popup
function sendDataToPopup(data: ConversationData): void {
  try {
    // 使用Chrome storage API存储数据
    chrome.storage.local.set({ conversationData: data }, () => {
      console.log('Conversation data saved to storage')
      
      // 发送消息通知popup更新
      chrome.runtime.sendMessage({
        type: 'CONVERSATION_UPDATED',
        data: data
      }).catch(error => {
        // 忽略错误，popup可能没有打开
        console.log('Popup not available:', error.message)
      })
    })
  } catch (error) {
    console.error('Error sending data to popup:', error)
  }
}

// 手动提取执行函数
async function performExtraction(): Promise<ConversationData> {
  console.log('AI Studio manual extraction started')
  
  try {
    // 1. 自动点击Edit按钮
    await clickEditButtons()
    
    // 2. 等待一段时间让编辑模式生效
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 3. 提取对话数据
    const conversationData = extractConversationData()
    
    console.log(`Extracted ${conversationData.turns.length} conversation turns`)
    return conversationData
    
  } catch (error) {
    console.error('Error in extraction:', error)
    return { turns: [], timestamp: Date.now() }
  }
}

// Content script加载完成
console.log('AI Studio content script loaded and ready')

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'GET_CONVERSATION_DATA') {
    const data = extractConversationData()
    sendResponse(data)
  } else if (message.type === 'EXTRACT_DATA') {
    try {
      const data = await performExtraction()
      sendResponse(data)
    } catch (error) {
      sendResponse({ turns: [], timestamp: Date.now(), error: (error as Error).message })
    }
  }
  
  // 返回true表示异步响应
  return true
})