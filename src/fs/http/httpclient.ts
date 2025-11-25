
import type { ApiClient, FileSet } from "../apiclient";
import { HTTPFileSet } from "./httpfileset";

export type HttpContentFile = {
    content: string;
    contentType: string;
};

export type HttpTrackedFile = {
    name: string;
    path: string;
    contentType: string;
    content?: string;
    download_url?: string;
    dataUrl?: string;
};

export class HTTPClient implements ApiClient {
    baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    createFileSet(folder: string, _recursive: boolean): FileSet {
        return new HTTPFileSet(this, folder);
    }

}
