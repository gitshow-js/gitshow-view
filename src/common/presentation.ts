import type { ContentFile, FileSet, TrackedFile } from "../fs/apiclient";


export type PresentationStatus = {
    ok: boolean;
    code?: string;
    message?: string;
}

interface PresentationConfig {
    contents: string[];
    template?: {
        properties?: Record<string, any>;
    };
    [key: string]: any;
}

export class Presentation {
    rootFolder: FileSet;
    templateFolder: FileSet;
    assetsFolder: FileSet;
    config: PresentationConfig = { contents: [] };
    template: any = {};
    baseUrl: string | null = null;
    status: PresentationStatus = { ok: false };

    constructor(rootFolder: FileSet, templateFolder: FileSet, assetsFolder: FileSet) {
        this.rootFolder = rootFolder;
        this.templateFolder = templateFolder;
        this.assetsFolder = assetsFolder;
    }

    async refreshFolder(): Promise<void> {
        this.status = { ok: true, message: 'Presentation ok' };

        // Refresh root folder contents
        try {
            await this.rootFolder.refreshFolder();
        } catch (e) {
            let err = e as any;
            this.status = this.errorStatus(err, 'Could not read the referenced repository or folder');
            return; // Root folder not found, no presentation to load
        }

        // Refresh template folder contents
        try {
            await this.templateFolder.refreshFolder();
        } catch (e) {
            let err = e as any;
            this.status = this.errorStatus(err, 'The template folder does not exist within the source folder or is not readable');
            return; // Template folder not found, no presentation to load
        }

        // Refresh assets folder contents (optional)    
        try {
            await this.assetsFolder.refreshFolder();
        } catch (e) {
        }

        // Everything fine, check status
        if (this.status.ok) {
            // check and read the config file presentation.json
            const pconfig = this.getConfigFile();
            if (pconfig) {
                this.config = await this.readConfig() || { contents: [] };
            } else {
                this.status = { 
                    ok: false, 
                    code: 'Error',
                    message: 'The source folder does not contain the <code>presentation.json</code> file' 
                };
            }

            // check and read the template definition template/template.json
            this.template = await this.readTemplateDefinition();
            if (!this.template) {
                this.status = { 
                    ok: false, code: 'Error',
                    message: '<p><span class="error"></span> The source folder does not contain the <code>template/template.json</code> file</p>' 
                };
            }

            this.baseUrl = this.detectBaseUrl();
        }
    }

    errorStatus(err: any, messagePrefix: string): PresentationStatus {
        let msg = messagePrefix;
        if (err.message) {
            msg += ': '+ err.message;
        }
        return { 
            ok: false, 
            code: err.code ? err.code : 404, 
            message: msg
        };
    }

    getConfigFile(): TrackedFile | null {
        return this.rootFolder.getFileData('presentation.json');
    }

    detectBaseUrl(): string | null {
        const configFile = this.getConfigFile();
        if (configFile) {
            const url = (configFile as any).download_url;
            if (url) {
                return url.substring(0, url.length - 'presentation.json'.length);
            }
        }
        return null;
    }

    async readConfig(): Promise<PresentationConfig | null> {
        const configFile = this.getConfigFile();
        if (configFile) {
            const configData = await this.rootFolder.readFile(configFile.name)
            if (configData && configData.content) {
                configFile.content = configData.content;
                configFile.origContent = configData.content;
                (configFile as any).isConfig = true; // mark configuration file
                return JSON.parse(configData.content);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    getConfig(): PresentationConfig {
        return this.config;
    }

    getContentFiles(): TrackedFile[] {
        let ret: TrackedFile[] = [];
        for (let fname of this.config.contents) {
            const file = this.rootFolder.getFileData(fname);
            if (file) {
                ret.push(file);
            } else {
                // file does not exist, create a new one in the root folder
                const newFile = this.rootFolder.createTrackedFile(fname);
                this.rootFolder.addFile(newFile);
                ret.push(newFile as TrackedFile);
            }
        }
        return ret;
    }

    addContentFile(fname: string, index?: number): void {
        if (typeof index === 'undefined') {
            this.config.contents.push(fname);
        } else {
            this.config.contents.splice(index, 0, fname);
        }
        this.updateConfigFile();
    }

    renameContentFile(oldName: string, newName: string): void {
        for (let i = 0; i < this.config.contents.length; i++) {
            if (this.config.contents[i] === oldName) {
                this.config.contents[i] = newName;
                this.updateConfigFile();
                break;
            }
        }
    }

    /**
     * Moves the content file from one position in the list to another.
     * @param {number} fromIndex
     * @param {number} toIndex 
     */
    reorderContentFile(oldIndex: number, newIndex: number): void {
        if (oldIndex!== newIndex) {
            this.config.contents.splice(newIndex, 0, this.config.contents.splice(oldIndex, 1)[0]);
            this.updateConfigFile();
        }
    }

    removeContentFile(fname: string): void {
        for (let i = 0; i < this.config.contents.length; i++) {
            if (this.config.contents[i] === fname) {
                this.config.contents.splice(i, 1);
                this.updateConfigFile();
                break;
            }
        }
    }

    getConfigFileContent(): string {
        // create a copy of config while excluding deleted files from config.contents
        const configCopy = { ...this.config };
        const newContents: string[] = [];
        for (let fname of configCopy.contents) {
            const file = this.rootFolder.getFileData(fname);
            if (file && !file.delete) {
                newContents.push(file.name);
            }
        }
        configCopy.contents = newContents;
        // serialize the config and return
        return JSON.stringify(configCopy, null, 4);
    }

    /**
     * Update the config file with the updated content.
     */
    updateConfigFile(): void {
        const configFile = this.getConfigFile();
        if (configFile) {
            configFile.content = this.getConfigFileContent();
        }
    }

    isConfigModified(): boolean {
        const configFile = this.getConfigFile();
        if (configFile) {
            return this.rootFolder.isFileModified(configFile);
        }
        return false;
    }

    async readContentFile(fname: string): Promise<ContentFile> {
        return await this.rootFolder.readFile(fname);
    }

    async getMarkdownContent(): Promise<ContentFile[]> {
        let ret: ContentFile[] = [];
        for (let fname of this.config.contents) {
            const file = await this.readContentFile(fname);
            ret.push(file);
        }
        return ret;
    }

    // ===========================================================================================

    async readTemplateDefinition(): Promise<any> {
        const data = await this.templateFolder.readFile('template.json');
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

    replacePlaceholders(template: any, properties: Record<string, any>): any {
        if (typeof template === 'string') {
            let exactMatch = template.match(/^\${(.*?)}$/);
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
            const result: { [key: string]: string } = {};
            for (const key in template) {
                if (Object.hasOwnProperty.call(template, key)) {
                    result[key] = this.replacePlaceholders(template[key], properties);
                }
            }
            return result;
        } else {
            return template;
        }
    }

}