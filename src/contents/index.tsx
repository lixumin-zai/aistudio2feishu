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


// 手动提取执行函数
async function performExtraction(): Promise<ConversationData> {
  console.log('AI Studio manual extraction started')
  
  try {
    
    
    let title = ""
    const turns: ConversationTurn[] = []

    const titleElement = document.querySelector('h1.actions.pointer.v3-font-headline-2')
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

// Content script加载完成
console.log('AI Studio content script loaded and ready')

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