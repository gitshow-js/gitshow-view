export class Presentation {

    apiClient = null;
    rootFolderData = [];
    templateFolderData = [];
    status = {};
    config = {};
    template = {};

    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    getStatus() {
        return this.status;
    }

    getFolderData() {
        return this.rootFolderData;
    }

    async refreshFolder() {
        this.rootFolderData = await this.apiClient.getFileList();
        this.templateFolderData = await this.apiClient.getFileList('template');
        this.status = this.checkPresentationHealth(this.rootFolderData);
        this.config = await this.readConfig();
        this.template = await this.readTemplateDefinition();
    }

    checkPresentationHealth() {
        // must contain presentation.json
        const pconfig = this.getConfigFile();
        if (!pconfig) {
            return { ok: false, message: 'The folder does not contain the presentation.json file' }
        }
        // TODO check template and contents
        // all ok
        return  { ok: true, message: 'Presentation ok' }
    }

    getConfigFile() {
        return this.getFileByName(this.rootFolderData, 'presentation.json');
    }

    getFileByName(folderData, name) {
        for (let file of folderData) {
            if (file.name === name) {
                return file;
            }
        }
        return null;
    }

    async readFile(fileData) {
        return await this.apiClient.getFile(fileData.name);
    }

    async readConfig() {
        const configFile = this.getConfigFile();
        if (configFile) {
            const configData = await this.readFile(configFile)
            if (configData && configData.content) {
                return JSON.parse(configData.content);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    getConfig() {
        return this.config;
    }

    async getMarkdownFile(fname) {
        const fileData = this.getFileByName(this.rootFolderData, fname);
        return await this.readFile(fileData);
    }

    async getMarkdownContent() {
        let ret = [];
        for (let fname of this.config.contents) {
            const fileData = this.getFileByName(this.rootFolderData, fname);
            const file = await this.readFile(fileData);
            ret.push(file);
        }
        return ret;
    }

    // ===========================================================================================

    async readTemplateDefinition() {
        const data = await this.apiClient.getFile('template/template.json');
        if (data && data.content) {
            let ret = JSON.parse(data.content);
            if (this.config.template?.properties) {
                ret = this.replacePlaceholders(ret, this.config.template.properties);
            }
            return ret;
        } else {
            return null;
        }
    }

    replacePlaceholders(template, properties) {
        if (typeof template === 'string') {
            let exactMatch = template.match(/\${(.*?)}/);
            if (exactMatch) { // exact match - return the property value
                return properties[exactMatch[1]] || exactMatch[0];
            } else { // replace in a string
                return template.replace(/\${(.*?)}/g, (match, propertyName) => {
                    return properties[propertyName] || match;
                });
            }
        } else if (Array.isArray(template)) {
            return template.map(item => this.replacePlaceholders(item, properties));
        } else if (typeof template === 'object' && template !== null) {
            const result = {};
            for (const key in template) {
                if (template.hasOwnProperty(key)) {
                    result[key] = this.replacePlaceholders(template[key], properties);
                }
            }
            return result;
        } else {
            return template;
        }
    }


}