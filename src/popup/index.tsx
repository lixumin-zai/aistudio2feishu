import { useEffect, useState } from "react"

// 引入飞书SDK
import { GetTenantAccessToken, UploadFeishu } from '../api/feishuSDK'

const uploadFeishu = new UploadFeishu()

function IndexPopup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [appId, setAppId] = useState(() => {
    return localStorage.getItem('feishu_app_id') || 'cli_******'
  })
  const [appSecret, setAppSecret] = useState(() => {
    return localStorage.getItem('feishu_app_secret') || '******'
  })
  const [objToken, setObjToken] = useState(() => {
    return localStorage.getItem('feishu_obj_token') || '******'
  }) 

  // 保存配置到localStorage
  const saveAppId = (value: string) => {
    setAppId(value)
    localStorage.setItem('feishu_app_id', value)
  }

  const saveAppSecret = (value: string) => {
    setAppSecret(value)
    localStorage.setItem('feishu_app_secret', value)
  }

  const saveObjToken = (value: string) => {
    setObjToken(value)
    localStorage.setItem('feishu_obj_token', value)
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
              const data = {
                "index": 0,
                "children": response.turns.flatMap((item) => {
                  if (item.role === 'user') {
                    return [
                      {
                        "block_type": 19,
                        "callout": {
                          "background_color": 14,
                          "border_color": 5,
                          "text_color": 5,
                          "emoji_id": 1
                        }
                      },
                      {
                        "block_type": 2,
                        "text": {
                          "elements": [
                            {
                              "text_run": {
                                "content": item.content
                              }
                            }
                          ],
                          "style": {}
                        }
                      }
                    ]
                  } else {
                    // model角色使用不同颜色
                    return [
                      {
                        "block_type": 19,
                        "callout": {
                          "background_color": 10,
                          "border_color": 3,
                          "text_color": 3,
                          "emoji_id": 2
                        }
                      },
                      {
                        "block_type": 2,
                        "text": {
                          "elements": [
                            {
                              "text_run": {
                                "content": item.content
                              }
                            }
                          ],
                          "style": {}
                        }
                      }
                    ]
                  }
                })
              }
              const accessToken = await getTenantAccessToken.call()
              const isSuccess = await uploadFeishu.writeDocx(accessToken, obj_token, obj_token, data)
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
      <h2 style={{ margin: 0, fontSize: 20, color: '#202124', marginBottom: 24, fontWeight: 600 }}>AI Studio 对话提取</h2>
      
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
        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#5f6368', fontWeight: 500 }}>文档Token</label>
            <input
              type="text"
              value={objToken}
              onChange={(e) => saveObjToken(e.target.value)}
              placeholder="请输入飞书文档的Token"
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
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <button 
          onClick={extractData}
          disabled={extracting}
          style={{
            padding: '12px 24px',
            backgroundColor: extracting ? '#f1f3f4' : '#4285f4',
            color: extracting ? '#5f6368' : 'white',
            border: 'none',
            borderRadius: 8,
            cursor: extracting ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: extracting ? 'none' : '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
            minWidth: 120
          }}
          onMouseEnter={(e) => {
              if (!extracting) {
                ;(e.target as HTMLButtonElement).style.backgroundColor = '#3367d6'
                ;(e.target as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12)'
              }
            }}
            onMouseLeave={(e) => {
              if (!extracting) {
                ;(e.target as HTMLButtonElement).style.backgroundColor = '#4285f4'
                ;(e.target as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
              }
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
          padding: 16, 
          backgroundColor: '#fef7f0', 
          border: '1px solid #fce8e6', 
          borderRadius: 8, 
          color: '#d93025',
          marginBottom: 20,
          fontSize: 14,
          lineHeight: 1.4
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default IndexPopup
