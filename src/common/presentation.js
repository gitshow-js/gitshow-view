export class Presentation {

    apiClient = null;
    rootFolderData = [];
    templateFolderData = [];
    status = {};
    config = {};
    template = {};
    baseUrl = null;

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
        let healthMsg = '';
        let url = this.apiClient.getSourceUrl();
        // load the presentation root folder
        try {
            this.rootFolderData = await this.apiClient.getFileList();
            healthMsg = `<p><span class="ok"></span> The presentation source folder exists:<br><a href="${url}">${url}</a></p>`;
        } catch (e) {
            this.status = { ok: false, code: 404, message: `<p><span class="error"></span> The referenced repository or folder does not exist:<br><a href="${url}">${url}</a></p>` };
            return;
        }
        // load the presentation template folder
        try {
            this.templateFolderData = await this.apiClient.getFileList('template');
            healthMsg += `<p><span class="ok"></span> The template folder exists within the source folder</p>`;
        } catch (e) {
            healthMsg += `<p><span class="error"></span> The template folder does not exist within the source folder</p>`;
            this.status = { ok: false, code: 404, message: healthMsg };
            return;
        }
        // check the presentation config files and contents
        this.status = this.checkPresentationHealth(this.rootFolderData);
        // concatenate the results of all checks
        this.status.message = healthMsg + this.status.message;
        if (this.status.ok) {
            this.baseUrl = this.detectBaseUrl();
            console.log('BASE = ' + this.baseUrl);
            this.config = await this.readConfig();
            this.template = await this.readTemplateDefinition();
        }
    }

    checkPresentationHealth() {
        // must contain presentation.json
        const pconfig = this.getConfigFile();
        if (!pconfig) {
            return { ok: false, code: 'Error', message: '<p><span class="error"></span> The source folder does not contain the <code>presentation.json</code> file</p>' };
        }
        const tconfig = this.getFileByName(this.templateFolderData, 'template.json');
        if (!tconfig) {
            return { ok: false, code: 'Error', message: '<p><span class="error"></span> The source folder does not contain the <code>template/template.json</code> file</p>' };
        }
        // TODO check template and contents
        // all ok
        return  { ok: true, message: 'Presentation ok' }
    }

    getFileData(name) {
        return this.getFileByName(this.rootFolderData, name);
    }

    getConfigFile() {
        return this.getFileData('presentation.json');
    }

    getFileByName(folderData, name) {
        for (let file of folderData) {
            if (file.name === name) {
                return file;
            }
        }
        return null;
    }

    async readFile(fname) {
        return await this.apiClient.getFile(fname);
    }

    detectBaseUrl() {
        const configFile = this.getConfigFile();
        if (configFile) {
            const url = configFile.download_url;
            return url.substring(0, url.length - 'presentation.json'.length);
        }
    }

    async readConfig() {
        const configFile = this.getConfigFile();
        if (configFile) {
            const configData = await this.readFile(configFile.name)
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

    getContentFiles() {
        let ret = [];
        for (let fname of this.config.contents) {
            const file = this.getFileByName(this.rootFolderData, fname);
            if (file) {
                ret.push(file);
            }
        }
        return ret;
    }

    async getMarkdownContent() {
        let ret = [];
        for (let fname of this.config.contents) {
            const file = await this.readFile(fname);
            ret.push(file);
        }
        return ret;
    }

    // ===========================================================================================

    async readTemplateDefinition() {
        const data = await this.readFile('template/template.json');
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