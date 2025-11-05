
import type { GHClient, RepositoryFile } from "../fs/ghclient";

// Define a type for the file objects used in this class
export type TrackedFile = {
    name: string;
    path: string;
    sha: string | null;
    size: number;
    type: 'file' | 'dir';
    content?: string;
    origContent?: string;
    dataUrl?: string;
    delete?: boolean;
    create?: boolean;
    getChanges: () => any;
    applyChanges: () => void;
};

/**
 * A set of files where changes are tracked
 */
export class FileSet {

    apiClient: GHClient;
    folder: string;  // the folder where the files are tracked
    fileData: TrackedFile[] = []; 
    origFiles: { [sha: string]: TrackedFile } = {}; 

    constructor(apiClient: GHClient, folder: string) {
        this.apiClient = apiClient;
        this.folder = folder;
    }

    async refreshFolder(): Promise<void> {
        const files = await this.apiClient.getFileList(this.folder);
        this.fileData = [];
        for (let file of files) {
            if (file.type === 'file') { // only consider regular files
                this.origFiles[file.sha] = { ...file };
                const fset = this;
                file.getChanges = () => fset.getChanges(file);
                file.applyChanges = () => fset.applyChanges(file);
                this.fileData.push(file);
            }
        }
    }

    /**
     * Base file set is the file set containing all files in the folder.
     */
    getBaseFileSet(): FileSet {
        // for a normal FileSet, the base file set is the same as the current one
        return this;
    }

    getFiles(): TrackedFile[] {
        return this.fileData;
    }

    getFileData(name: string): TrackedFile | null {
        for (let file of this.fileData) {
            if (file.name === name) {
                return file;
            }
        }
        return null;
    }

    indexOfFile(file: TrackedFile): number {
        for (let i = 0; i < this.fileData.length; i++) {
            if (this.fileData[i].name === file.name) {
                return i;
            }
        }
        return -1;
    }

    replaceFileData(file: TrackedFile): void {
        const index = this.indexOfFile(file);
        if (index!== -1) {
            this.fileData[index] = file;
        }
    }

    async readFile(fname: string): Promise<RepositoryFile> {
        const path = (this.folder.length > 0) ? this.folder + '/' + fname : fname;
        return await this.apiClient.getFile(path);
    }
    
    isFileModified(file: TrackedFile): boolean {
        return (this.getChanges(file) !== null);
    }

    getChanges(file: TrackedFile): any | null {
        let curChange: any = { file: file };
        let changed = false;
        // if origContent is available, compare with the current content
        if (file.content && file.origContent) {
            if (file.content !== file.origContent) {
                curChange.content = file.content;
                curChange.origContent = file.origContent;
                changed = true;
            }
        }
        // detect deletion
        if (file.delete) {
            curChange.delete = true;
            return curChange;
        }
        // compare with the original file
        const ofile = file.sha ? this.origFiles[file.sha] : null;
        if (ofile) {
            if (file.name !== ofile.name) { // renamed file
                curChange.name = file.name;
                curChange.origName = ofile.name;
                curChange.path = file.path;
                curChange.origPath = ofile.path;
                changed = true;
            } else if (file.dataUrl) { // new content uploaded
                if (!ofile.dataUrl || ofile.dataUrl !== file.dataUrl) {
                    curChange.dataUrl = file.dataUrl;
                    changed = true;
                }
            }
        } else {
            // no original file found, the file must have been added
            curChange.create = true;
            if (file.content) {
                curChange.content = file.content;
            }
            if (file.dataUrl) {
                curChange.dataUrl = file.dataUrl;
            }
            changed = true;
        }
        // add the change to the list if it was made
        if (changed) {
            return curChange;
        } else {
            return null; // no changes
        }
    }

    /**
     * Applies the changes to the file.
     * 
     * @param {File} file - the file to be updated with the changes
     */
    applyChanges(file: TrackedFile): void {
        if (file.delete) {
            // delete the file from the file set
            const index = this.indexOfFile(file);
            console.log(`Deleting file: ${file.name} at index ${index}`);
            if (index !== -1) {
                this.fileData.splice(index, 1);
            }
        } else {
            if (file.origContent && file.content) {
                file.origContent = file.content;
            }
            file.create = false;
            if (file.sha) {
                this.origFiles[file.sha] = { ...file };
            }
        }
    }

    /**
     * Scans the content files and returns a list of changed files.
     * @returns {Array} changes - an array of files with the change property filled with the change details.
     */
    scanModifiedFiles(): any[] {
        const cfiles = [];
        for (const file of this.getFiles()) {
            const changes = file.getChanges();
            if (changes) {
                cfiles.push({ ...file, changes });
            }
        }
        return cfiles;
    }

    applyAllChanges(): void {
        for (const file of this.getFiles()) {
            const changes = file.getChanges();
            if (changes) {
                file.applyChanges();
            }
        }
    }

    /**
     * Gets the full path of the repository folder where the files are tracked.
     * 
     * @returns the full path of the folder
     */
    getFolderPath(): string {
        const prefix = this.apiClient.folder;
        const folder = this.folder === '' ? '' : '/' + this.folder;
        console.log('getFolderPath', prefix, folder);
        return prefix + folder;
    }

    /**
     * Adds a new file to the file set.
     * 
     * @param {*} newFile the file to be added containing at least the name property.
     */
    addFile(newFile: any): void {
        this.fileData.push(newFile);
        newFile.path = this.getFolderPath() + '/' + newFile.name;
        newFile.create = true;
        newFile.getChanges = () => this.getChanges(newFile);
        newFile.applyChanges = () => this.applyChanges(newFile);
    }

    removeFile(name: string): boolean {
        for (let i = 0; i < this.fileData.length; i++) {
            if (this.fileData[i].name === name) {
                this.fileData.splice(i, 1);
                console.log('removeFile', name);
                return true;
            }
        }
        return false;
    }

}
