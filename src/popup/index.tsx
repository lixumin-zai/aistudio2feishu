import { useEffect, useState } from "react"

// 引入飞书SDK
import { GetTenantAccessToken, UploadFeishu} from '../api/feishuSDK'

const uploadFeishu = new UploadFeishu()

function IndexPopup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  // 使用 chrome.storage.local 持久化配置（替代 localStorage）
  const [appId, setAppId] = useState<string>("")
  const [appSecret, setAppSecret] = useState<string>("")
  const [objToken, setObjToken] = useState<string>("")

  // 保存配置到 chrome.storage.local
  const saveAppId = (value: string) => {
    setAppId(value)
    chrome.storage.local.set({ feishu_app_id: value })
  }

  const saveAppSecret = (value: string) => {
    setAppSecret(value)
    chrome.storage.local.set({ feishu_app_secret: value })
  }

  const saveObjToken = (value: string) => {
    setObjToken(value)
    chrome.storage.local.set({ feishu_obj_token: value })
  }

  // 初始化时从 chrome.storage.local 读取配置（并兼容迁移旧的 localStorage）
  useEffect(() => {
    chrome.storage.local
      .get(["feishu_app_id", "feishu_app_secret", "feishu_obj_token"]) 
      .then(async (res) => {
        const hasNewStore = !!(res.feishu_app_id || res.feishu_app_secret || res.feishu_obj_token)
        if (hasNewStore) {
          setAppId(res.feishu_app_id || "")
          setAppSecret(res.feishu_app_secret || "")
          setObjToken(res.feishu_obj_token || "")
          return
        }
        // 迁移旧的 localStorage 配置（如果存在）
        const legacyAppId = localStorage.getItem('feishu_app_id') || ""
        const legacyAppSecret = localStorage.getItem('feishu_app_secret') || ""
        const legacyObjToken = localStorage.getItem('feishu_obj_token') || ""
        if (legacyAppId || legacyAppSecret || legacyObjToken) {
          setAppId(legacyAppId)
          setAppSecret(legacyAppSecret)
          setObjToken(legacyObjToken)
          await chrome.storage.local.set({
            feishu_app_id: legacyAppId,
            feishu_app_secret: legacyAppSecret,
            feishu_obj_token: legacyObjToken
          })
          // 可选：清理旧值，避免混淆
          localStorage.removeItem('feishu_app_id')
          localStorage.removeItem('feishu_app_secret')
          localStorage.removeItem('feishu_obj_token')
        }
      })
  }, [])

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
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_DATA' })
        
        if (response && response.turns && response.turns.length > 0) {          
          // 调用飞书接口
          const getTenantAccessToken = new GetTenantAccessToken(appId, appSecret)
          
          // 获取访问令牌
          const accessToken = await getTenantAccessToken.call()

          if (accessToken) {
            console.log('成功获取飞书访问令牌')
            const obj_token = await uploadFeishu.createDocx(accessToken, objToken, response.title)
            if (obj_token) {
              // 先处理所有异步操作
              let markdown_text = ""
              const childrenPromises = response.turns.map((item) => {
                if (item.role === 'user') {
                  markdown_text += `---\n${item.content}\n---\n`
                } else {
                  markdown_text += `---\n${item.content}\n---\n`
                }
              })
              const [docx_block, first_level_block_ids] = await uploadFeishu.markdown2docx(accessToken, markdown_text)

              const data = {
                "index": 0,
                "children_id": first_level_block_ids,
                "descendants": docx_block
              }
              const isSuccess = await uploadFeishu.blockUpload(accessToken, obj_token, obj_token, data)
              if (isSuccess) {
                setError("上传成功")
              } else {
                setError("上传失败")
              }
            } else {
              setError("创建文档失败")
            }
            console.log("数据已准备好上传到飞书")
          } else {
            setError('获取飞书访问令牌失败，请检查App ID和App Secret')
          }
        } else if (response && response.error) {
          setError(`提取失败: ${response.error}`)
        } else {
          setError('未找到对话数据，请确保页面已加载完成且存在对话内容')
        }
      } catch (messageError) {
        setError(messageError.toString())
      }
    } catch (err) {
      setError('提取失败: ' + (err as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  useEffect(() => {

  }, [])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div style={{ width: 400, maxHeight: 600, padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#ffffff' }}>
      <h2 style={{ margin: 0, fontSize: 20, color: '#202124', marginBottom: 24, fontWeight: 600 }}>aistudio2feishu</h2>
      
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#5f6368', fontWeight: 500 }}>App ID</label>
          <input
            type="text"
            value={appId}
            onChange={(e) => saveAppId(e.target.value)}
            placeholder="请输入飞书应用的App ID"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              backgroundColor: '#fafbfc',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onFocus={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#4285f4'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#ffffff'
               ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(66, 133, 244, 0.1)'
             }}
             onBlur={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#e1e5e9'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#fafbfc'
               ;(e.target as HTMLInputElement).style.boxShadow = 'none'
             }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#5f6368', fontWeight: 500 }}>App Secret</label>
          <input
            type="password"
            value={appSecret}
            onChange={(e) => saveAppSecret(e.target.value)}
            placeholder="请输入飞书应用的App Secret"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              backgroundColor: '#fafbfc',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onFocus={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#4285f4'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#ffffff'
               ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(66, 133, 244, 0.1)'
             }}
             onBlur={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#e1e5e9'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#fafbfc'
               ;(e.target as HTMLInputElement).style.boxShadow = 'none'
             }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#5f6368', fontWeight: 500 }}>Obj Token（目标目录）</label>
          <input
            type="text"
            value={objToken}
            onChange={(e) => saveObjToken(e.target.value)}
            placeholder="请输入飞书文档目标目录token"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              backgroundColor: '#fafbfc',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onFocus={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#4285f4'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#ffffff'
               ;(e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(66, 133, 244, 0.1)'
             }}
             onBlur={(e) => {
               (e.target as HTMLInputElement).style.borderColor = '#e1e5e9'
               ;(e.target as HTMLInputElement).style.backgroundColor = '#fafbfc'
               ;(e.target as HTMLInputElement).style.boxShadow = 'none'
             }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={extractData}
          style={{
            flex: 1,
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          disabled={extracting}
        >
          {extracting ? '提取中...' : '提取并上传'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 16,
          padding: '10px 12px',
          borderRadius: 8,
          backgroundColor: error.includes('成功') ? '#e6f4ea' : '#fce8e6',
          color: error.includes('成功') ? '#137333' : '#c5221f'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default IndexPopup
