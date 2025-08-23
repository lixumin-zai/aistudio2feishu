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

  constructor() {
    this.create_url = "https://open.feishu.cn/open-apis/wiki/v2/spaces/:space_id/nodes";
    this.write_url = "https://open.feishu.cn/open-apis/docx/v1/documents/:document_id/blocks/:block_id/children?document_revision_id=-1"
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
  
}

export { GetTenantAccessToken, UploadFeishu };

// https://vsxa1w87lf.feishu.cn/wiki/FKQUwhXZbiSEFokmwKnctHmvneb