
export interface ApiClient {
    createFileSet(folder: string): FileSet;
}

export interface FileSet {
    refreshFolder(): Promise<void>;
    getFileData(name: string): Promise<TrackedFile | null>;
    readFile(fname: string): Promise<ContentFile>;
    createTrackedFile(fname: string): TrackedFile;
    addFile(file: TrackedFile): void;
    isFileModified(file: TrackedFile): boolean;
}

export type TrackedFile = {
    name: string;
    download_url?: string;
    [key: string]: any;
}

export type ContentFile = {
    content: string;
};
