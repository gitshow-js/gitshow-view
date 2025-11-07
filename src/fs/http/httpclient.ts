
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

}
