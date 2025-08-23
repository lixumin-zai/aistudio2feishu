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
  turns: ConversationTurn[],
  title: string,
  timestamp: number
}


// 提取对话内容
async function extractConversationData(): Promise<ConversationData> {
  const turns: ConversationTurn[] = []
  let title = 'AI Studio Conversation'
  
  try {
    // 获取页面标题
    const titleElement = document.querySelector('h1.actions.pointer.v3-font-headline-2')
    if (titleElement) {
      title = titleElement.textContent?.trim() || title
    }
    
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
            role: role.toLowerCase() === 'user' ? 'user' : 'model',
            content: content.trim()
          })
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
    title,
    timestamp: Date.now()
  }
}

// 手动提取执行函数
async function performExtraction(): Promise<ConversationData> {
  console.log('AI Studio manual extraction started')
  
  try {
    // 1. 自动点击Edit按钮
    const editButtons = document.querySelectorAll('button[aria-label="Edit"]')
    console.log(`Found ${editButtons.length} edit buttons`)
    
    for (const button of editButtons) {
      if (button instanceof HTMLElement) {
        button.click()
        console.log('Clicked edit button')
        // 等待一下让页面响应
        // await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    // 2. 等待一段时间让编辑模式生效
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 3. 提取对话数据
    const conversationData = await extractConversationData()

    await new Promise(resolve => setTimeout(resolve, 1000))
    for (const button of editButtons) {
      if (button instanceof HTMLElement) {
        button.click()
        console.log('Clicked edit button')
        // 等待一下让页面响应
        // await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    return conversationData
    
  } catch (error) {
    console.error('Error in extraction:', error)
    return { turns: [], title: 'AI Studio Conversation', timestamp: Date.now() }
  }
}

// Content script加载完成
console.log('AI Studio content script loaded and ready')

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONVERSATION_DATA') {
    console.log('AI Studio content script received GET_CONVERSATION_DATA message')
    extractConversationData().then(data => {
      sendResponse(data)
    }).catch(error => {
      sendResponse({ turns: [], timestamp: Date.now(), error: error.message })
    })
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