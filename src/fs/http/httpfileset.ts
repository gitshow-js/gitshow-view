
import type { FileSet, TrackedFile, ContentFile } from "../apiclient";
import type { HTTPClient } from "./httpclient";

export class HTTPFileSet implements FileSet {
    apiClient: HTTPClient;
    folder: string;
    files: TrackedFile[] = [];

    constructor(apiClient: HTTPClient, folder: string) {
        this.apiClient = apiClient;
        this.folder = folder;
    }

    async refreshFolder(): Promise<void> {
        // For a simple HTTP fileset, we cannot list files in a directory.
        // This method could be implemented to fetch a manifest file if one exists.
        // For now, it does nothing.
        return Promise.resolve();
    }

    async getFileData(name: string): Promise<TrackedFile | null> {
        let fdata = this.files.find(f => f.name === name);
        if (fdata) {
            return fdata;
        } else {
            // The file is not yet in the file set, so we try to fetch it from the server
            // and create a new TrackedFile with the fetched content
            try {
                const content = await this.fetchFile(name);
                const path = this.filePath(name);
                const download_url = this.fileURL(path);
                let newdata: TrackedFile = { 
                    name,
                    path,
                    download_url,
                    content
                };
                this.files.push(newdata);
                return newdata;
            } catch (error) {
                return null;
            }
        }
    }

    async readFile(fname: string): Promise<ContentFile> {
        const path = this.filePath(fname);
        const content = await this.fetchFile(path);
        return { content };
    }

    createTrackedFile(fname: string): TrackedFile {
        return { 
            name: fname
        };
    }

    addFile(file: TrackedFile): void {
        if (!this.getFileData(file.name)) {
            this.files.push(file);
        }
    }

    isFileModified(_file: TrackedFile): boolean {
        return false;
    }

    filePath(name: string): string {
        return this.folder ? `${this.folder}/${name}` : name;
    }

    fileURL(path: string): string {
        return new URL(path, this.apiClient.baseUrl).toString();
    }

    async fetchFile(path: string): Promise<string> {
        const url = this.fileURL(path);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }

}
