
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

    getFileData(name: string): TrackedFile | null {
        return this.files.find(f => f.name === name) || null;
    }

    async readFile(fname: string): Promise<ContentFile> {
        const path = this.folder ? `${this.folder}/${fname}` : fname;
        const content = await this.apiClient.fetchFile(path);
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

    isFileModified(file: TrackedFile): boolean {
        // A simple HTTP file set is read-only, so files are never modified.
        return false;
    }
}
