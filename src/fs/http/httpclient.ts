
import type { ApiClient, FileSet } from "../apiclient";
import { HTTPFileSet } from "./httpfileset";

export class HTTPClient implements ApiClient {
    baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    createFileSet(folder: string): FileSet {
        return new HTTPFileSet(this, folder);
    }

    async fetchFile(path: string): Promise<string> {
        const url = new URL(path, this.baseUrl).toString();
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }
}
