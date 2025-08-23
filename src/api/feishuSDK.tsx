class GetTenantAccessToken {
  private url: string;
  private reqBody: {
    app_id: string;
    app_secret: string;
  };

  constructor(APP_ID: string, APP_SECRET: string) {
    this.url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/";
    this.reqBody = { app_id: APP_ID, app_secret: APP_SECRET };
  }

  async call(): Promise<any | undefined> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.reqBody),
      });
      
      const result = await response.json();
      const code = result.code ?? -1;
      
      if (code === 0) {
        return result.tenant_access_token;
      }
    } catch (error) {
      return undefined
    }
    return undefined;
  }
}

class UploadFeishu {
  private create_url: string;
  private write_url: string;
  private markdown2docx_url: string;

  constructor() {
    this.create_url = "https://open.feishu.cn/open-apis/wiki/v2/spaces/:space_id/nodes";
    this.write_url = "https://open.feishu.cn/open-apis/docx/v1/documents/:document_id/blocks/:block_id/children?document_revision_id=-1";
    this.markdown2docx_url = "https://open.feishu.cn/open-apis/docx/v1/documents/blocks/convert"
  }
  async createDocx(tenantAccessToken: string, folder_token: string, title: string): Promise<string> {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + tenantAccessToken,
    };

    const reqBody = {
      obj_type: "docx",
      node_type: "origin",
      title: title,
    };
    const url = this.create_url.replace(":space_id", folder_token);
    console.log(url)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(reqBody),
      });
      
      const result = await response.json();
      console.log(result)
      const code = result.code ?? -1;
      if (code === 0) {
        return result.data.node.obj_token;
      }
    } catch (error) {
      return ""
    }
    return ""

  }

  async writeDocx(tenantAccessToken: string, document_id: string, block_id: string, data: object): Promise<boolean> {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + tenantAccessToken,
    };
    const url = this.write_url.replace(":document_id", document_id).replace(":block_id", block_id)
    console.log(url)
    console.log(data)
    console.log(JSON.stringify(data))
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
      });
      const result = await response.json();
      console.log(result)
      const code = result.code ?? -1;
      if (code === 0) {
        console.log()
        return true
      }
    } catch (error) {
      return false
    }
    return false

  }

  async markdown2docx(tenantAccessToken: string, content: string): Promise<object[]> {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + tenantAccessToken,
    };
    const reqBody = {
      content_type: "markdown",
      content: content,
    };
    try {
      const response = await fetch(this.markdown2docx_url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(reqBody),
      });
      const result = await response.json();
      const code = result.code ?? -1;
      if (code === 0) {
        const first_level_block_ids = result.data.first_level_block_ids;
        const blocks = result.data.blocks || [];
        
        // 根据first_level_block_ids的顺序对blocks进行排序
        const sortedBlocks = blocks.sort((a: any, b: any) => {
          const indexA = first_level_block_ids.indexOf(a.block_id);
          const indexB = first_level_block_ids.indexOf(b.block_id);
          
          // 如果block_id不在first_level_block_ids中，放到最后
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
        
        return sortedBlocks;
      }
    } catch (error) {
      return []
    }
    return []
  }
  
}

export { GetTenantAccessToken, UploadFeishu};

// https://vsxa1w87lf.feishu.cn/wiki/FKQUwhXZbiSEFokmwKnctHmvneb