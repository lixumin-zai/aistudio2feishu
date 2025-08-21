import { useEffect, useState } from "react"

// 定义对话数据接口
interface ConversationTurn {
  role: 'user' | 'model'
  content: string
}

interface ConversationData {
  turns: ConversationTurn[]
  timestamp: number
}

function IndexPopup() {
  const [conversationData, setConversationData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)

  // 从storage加载已保存的数据
  const loadStoredData = async () => {
    try {
      const result = await chrome.storage.local.get(['conversationData'])
      if (result.conversationData) {
        setConversationData(result.conversationData)
      }
    } catch (err) {
      console.log('加载存储数据失败:', err)
    }
  }

  // 手动提取数据
  const extractData = async () => {
    try {
      setExtracting(true)
      setError(null)
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) {
        setError('无法获取当前标签页')
        return
      }

      // 检查是否在正确的网站
      if (!tabs[0].url?.includes('aistudio.google.com')) {
        setError('请在 aistudio.google.com 页面使用此插件')
        return
      }

      // 发送提取请求到content script
      const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_DATA' })
      
      if (response && response.turns && response.turns.length > 0) {
        setConversationData(response)
        // 保存到storage
        chrome.storage.local.set({ conversationData: response })
      } else {
        setError('未找到对话数据，请确保页面已加载完成')
      }
    } catch (err) {
      setError('提取失败: ' + (err as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  // 组件加载时从storage加载已保存的数据
  useEffect(() => {
    loadStoredData()

    // 监听来自content script的消息
    const messageListener = (message: any) => {
      if (message.type === 'CONVERSATION_UPDATED' && message.data) {
        setConversationData(message.data)
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    // 监听storage变化
    const storageListener = (changes: any) => {
      if (changes.conversationData) {
        setConversationData(changes.conversationData.newValue)
      }
    }

    chrome.storage.onChanged.addListener(storageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      chrome.storage.onChanged.removeListener(storageListener)
    }
  }, [])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div style={{ width: 400, maxHeight: 600, padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#333' }}>AI Studio 对话提取</h2>
        <button 
          onClick={extractData}
          disabled={extracting}
          style={{
            padding: '8px 16px',
            backgroundColor: extracting ? '#ccc' : '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: extracting ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 'bold'
          }}
        >
          {extracting ? '提取中...' : '提取对话'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
          加载中...
        </div>
      )}

      {error && (
        <div style={{ 
          padding: 12, 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          borderRadius: 4, 
          color: '#c33',
          marginBottom: 16,
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {!loading && !error && !conversationData && (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>暂无对话数据</p>
          <p style={{ fontSize: 12, color: '#999' }}>请在 aistudio.google.com 页面上点击「提取对话」按钮</p>
        </div>
      )}

      {conversationData && conversationData.turns.length > 0 && (
        <div>
          <div style={{ 
            fontSize: 12, 
            color: '#666', 
            marginBottom: 12,
            textAlign: 'center'
          }}>
            提取时间: {formatTimestamp(conversationData.timestamp)}
          </div>
          
          <div style={{ maxHeight: 450, overflowY: 'auto' }}>
            {conversationData.turns.map((turn, index) => (
              <div 
                key={index} 
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: turn.role === 'user' ? '#e3f2fd' : '#f3e5f5',
                  border: `1px solid ${turn.role === 'user' ? '#bbdefb' : '#e1bee7'}`
                }}
              >
                <div style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: turn.role === 'user' ? '#1976d2' : '#7b1fa2',
                  marginBottom: 6
                }}>
                  {turn.role === 'user' ? '👤 用户' : '🤖 AI模型'}
                </div>
                <div style={{
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: '#333',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {turn.content}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ 
            fontSize: 12, 
            color: '#666', 
            textAlign: 'center',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #eee'
          }}>
            共 {conversationData.turns.length} 条对话
          </div>
        </div>
      )}
    </div>
  )
}

export default IndexPopup
