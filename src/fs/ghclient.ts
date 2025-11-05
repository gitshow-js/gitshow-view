
const API_ROOT = 'https://api.github.com';

export type RepositoryFile = {
    content: string;
    sha: string;
};

export class GHClient {

    CLIENT_ID = '5bc2aa3324e3cb27df55';

    username = '';
    repository = '';
    folder = '';
    branch = '';
    defaultBranch = 'main';
    onNotAuthorized: (() => void) | null = null;
    loginStatus: any = null;
    bearerToken: string | null = null;

    setUser(username: string) {
        this.username = username;
    }

    setRepository(repository: string) {
        this.repository = repository;
    }

    setFolder(path: string) {
        this.folder = this.normalizePath(path);
    }

    setBranch(name: string) {
        this.branch = name;
    }

    async useDefaultBranch(): Promise<void> {
        this.branch = await this.getDefaultBranch();
    }

    normalizePath(path: string): string {
        if (path && path.length > 0) {
            while (path.startsWith('/')) {
                path = path.substring(1);
            }
            while (path.endsWith('/')) {
                path = path.substring(0, path.length - 1);
            }
            return path;
        } else {
            return '';
        }
    }

    /**
     * The URL of the source presentation on GitHub (for user reference)
     */
    getSourceUrl(): string {
        let ret = `https://github.com/${this.username}/${this.repository}`;
        if (this.branch && this.branch !== this.defaultBranch) {
            ret += `/tree/${this.branch}`;
            if (this.folder) {
                ret += `/${this.folder}`;
            }
        } else {
            if (this.folder) {
                ret += `/tree/${this.defaultBranch}/${this.folder}`;
            }
        }
        return ret;
    }

    /**
     * The URL of the any folder on GitHub (for user reference)
     */
    getFolderUrl(folder: string): string {
        let ret = `https://github.com/${this.username}/${this.repository}`;
        if (this.branch && this.branch !== this.defaultBranch) {
            ret += `/tree/${this.branch}`;
            if (folder) {
                ret += `/${folder}`;
            }
        } else {
            if (folder) {
                ret += `/tree/${this.defaultBranch}/${folder}`;
            }
        }
        return ret;
    }

    //===================================================================================

    userEndpoint(username: string): string {
        return API_ROOT + '/users/' + username;
    }

    repositoryEndpoint(): string {
        return API_ROOT + '/repos/' + this.username + '/' + this.repository;
    }

    fileEndpoint(path: string): string {
        let fpath = this.folder || '';
        if (path && path.length > 0) {
            fpath = fpath + '/' + path;
        }
        let rpath = '/contents';
        if (fpath.length > 0) {
            rpath = rpath + '/' + fpath;
        }
        return this.repositoryEndpoint() + rpath + '?ref=' + this.branch;
    }

    //===================================================================================

    async getUserRepos(): Promise<any> {
        const response = await fetch(this.userEndpoint(this.username) + '/repos', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }

    //===================================================================================

    async fetchUser(): Promise<any> {
        const response = await fetch(API_ROOT + '/user', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }
  
    hasToken(): boolean {
		return (localStorage.getItem('ghtoken') !== null);
	}

	logout(): void {
		localStorage.removeItem('ghtoken');
	}

    async getBranches(): Promise<any> {
        const response = await fetch(this.repositoryEndpoint() + '/branches', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }

    async getDefaultBranch(): Promise<string> {
        const response = await fetch(this.repositoryEndpoint(), {
            headers: this.headers(),
        });
        const data = await response.json();
        return data.default_branch;
    }

    async login(token: string): Promise<void> {
        localStorage.setItem('ghtoken', token);
        this.loginStatus = await this.fetchUser();
        this.saveLoginStatus();
    }

    async loginWithAuthCode(code: string): Promise<boolean> {
        const response = await fetch('https://gitshow.net/token/gh.php?code=' + encodeURIComponent(code), {
            method: 'GET',
            headers: {
            }
        });
        const data = await response.formData();
        const accessToken = data.get('access_token');
        if (accessToken) {
            // Store the access token and mark the user as authenticated
            await this.login(accessToken as string);
            return true;
        }
        else {
            return false;
        }
    }

    checkAuth(response: Response): boolean {
		if (response.status == 401 || response.status == 403) {
			if (this.onNotAuthorized) {
				this.onNotAuthorized();
			}
			return false;
		} else {
			return true;
		}
	}

	headers(headers?: { [key: string]: string }): { [key: string]: string } {
		const src = headers ? headers : {};
		const token = localStorage.getItem('ghtoken');
		if (token) {
			return {
				...src,
				'Authorization': ('token ' + token)
			};
		} else {
			return src;
		}
	}

    saveLoginStatus(): void {
		window.localStorage.setItem('gitshow-login', JSON.stringify(this.loginStatus));
	}

	deleteLoginStatus(): void {
		window.localStorage.removeItem('gitshow-login');
	}

	restoreLoginStatus(): void {
		const data = window.localStorage.getItem('gitshow-login');
		if (data) {
			this.loginStatus = JSON.parse(data);
		}
		if (this.loginStatus && this.loginStatus.http_session_token) {
			this.bearerToken = this.loginStatus.http_session_token;
		}
	}

    //===================================================================================

    async getFileList(subfolder: string): Promise<any> {
        const url = this.fileEndpoint(subfolder ? subfolder : '');
        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers(),
        });
        this.checkAuth(response);
        if (response.status >= 300) {
            throw new Object({ code: response.status, message: response.statusText });
        }
        const data = await response.json();
        return data;
    }

    async getRawFile(path: string): Promise<RepositoryFile> {
        const url = this.fileEndpoint(path);
        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers(),
        });
        this.checkAuth(response);
        const data = await response.json();
        return {
            content: data.content,
            sha: data.sha
        }
    }

    async getFile(path: string): Promise<RepositoryFile> {
        let data = await this.getRawFile(path);
        if (data.content) {
            data.content = this.decodeBase64Text(data.content);
        }
        return data;
    }

    // see https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    decodeBase64Text(base64: string): string {
        const binString = window.atob(base64);
        const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
        return new TextDecoder().decode(bytes);
    }

    encodeTextToBase64(text: string): string {
        const bytes = new TextEncoder().encode(text);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte),).join("");
        return window.btoa(binString);
    }

    extractBase64Data(dataUrl: string): string {
        if (!dataUrl.startsWith("data:")) {
            throw new Error("Invalid Data URL " + dataUrl);
        }
        const base64Index = dataUrl.indexOf("base64,");
        if (base64Index === -1) {
            throw new Error("No base64 data found in URL " + dataUrl);
        }
        return dataUrl.substring(base64Index + 7);
    }
      
    //===================================================================================

    /**
     * Gets the SHA of the head commit of the current branch.
     * @returns the SHA of the head commit
     */
    async getHeadSha(): Promise<string> {
        const response = await fetch(this.repositoryEndpoint() + '/git/refs/heads/' + this.branch, {
            headers: this.headers(),
        });
        this.checkAuth(response);
        const data = await response.json();
        return data.object.sha;
    }

    /**
     * Creates a git blob.
     * @param {string} base64content the content to be commited in base64 format.
     * @returns The SHA of the blob.
     */
    async createBlob(base64content: string): Promise<string> {
        const response = await fetch(this.repositoryEndpoint() + '/git/blobs', {
            method: 'POST',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                content: base64content,
                encoding: 'base64',
            }),
        });
        this.checkAuth(response);
        const data = await response.json();
        return data.sha;
    }

    /**
     * Creatse a new tree on GitHub
     * @param {*} entireTree the tree data
     * @returns The SHA of the new tree.
     */
    async createTree(entireTree: any): Promise<string> {
        const response = await fetch(this.repositoryEndpoint() + '/git/trees', {
            method: 'POST',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(entireTree),
        });
        this.checkAuth(response);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        return data.sha;
    }

    /**
     * Creates a new commit on GitHub containing a tree.
     * @param {*} treeSha the SHA of the tree
     * @param {*} message commit message
     * @returns New commit SHA.
     */
    async commitTree(treeSha: string, message: string): Promise<string> {
        const headSha = await this.getHeadSha();
        const response = await fetch(this.repositoryEndpoint() + '/git/commits', {
            method: 'POST',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                message: message,
                tree: treeSha,
                parents: [headSha],
            }),
        });
        this.checkAuth(response);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        return data.sha;
    }

    /**
     * Updates the current branch to the given commit.
     * @param {string} commitSha The SHA of the commit to update to.
     */
    async updateBranch(commitSha: string): Promise<void> {
        const response = await fetch(this.repositoryEndpoint() + '/git/refs/heads/' + this.branch, {
            method: 'PATCH',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                sha: commitSha,
            }),
        });
        this.checkAuth(response);
        if (!response.ok) {
            throw new Error();
        }
    }

    /**
     * Commits the changed files to the current branch.
     * @param {*} cfiles A list of changed files with the change object.
     * @param {*} message commit message
     */
    async commitChanges(cfiles: any[], message: string): Promise<void> {
        const baseSha = await this.getHeadSha();
        let tree: any[] = [];
        for (let file of cfiles) {
            console.log('Committing file:', file);
            const change = file.changes;
            // prepare the blob content if some content has been changed
            let blobContent = null;
            if (change.content) {
                blobContent = this.encodeTextToBase64(change.content);
            } else if (change.dataUrl) {
                blobContent = this.extractBase64Data(change.dataUrl);
            }
            // deleted files
            if (change.delete) {
                tree.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    sha: null,
                });
            }
            // renamed files
            else if (change.name && change.path) {
                if (blobContent) {
                    // content also changed -- delete the old file and add the new one
                    tree.push({
                        path: change.origPath,
                        mode: '100644',
                        type: 'blob',
                        sha: null,
                    });
                    tree.push({
                        path: change.path,
                        mode: '100644',
                        type: 'blob',
                        sha: await this.createBlob(blobContent),
                    });
                } else {
                    // the file has been renamed but no content has changed
                    tree.push({
                        path: change.origPath,
                        mode: '100644',
                        type: 'blob',
                        sha: null,
                    });
                    tree.push({
                        path: file.path,
                        mode: '100644',
                        type: 'blob',
                        sha: file.sha,
                    });
                }
            }
            // added or changed files -- text content
            else if (blobContent) {
                tree.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    sha: await this.createBlob(blobContent),
                });
            }
        }
        let entireTree = {
            base_tree: baseSha,
            tree: tree,
        };
        console.log('entireTree', entireTree);
        
        const treeSha = await this.createTree(entireTree);
        console.log('treeSha', treeSha);

        const commitSha = await this.commitTree(treeSha, message);
        console.log('commitSha', commitSha);
        
        await this.updateBranch(commitSha);
    }

    /**
     * Recursively copies a folder from another GitHub repository to the current repository.
     * @param {*} srcClient The source GitHub client.
     * @param {*} templatePath The source path to the template folder.
     * @param {*} targetPath Target path in this repository relative to the current folder.
     * @param {*} message Commit message.
     */
    async copyFolder(srcClient: GHClient, templatePath: string, targetPath: string, message: string): Promise<void> {
        console.log('copyFolder', srcClient, templatePath, targetPath);
        console.log('destClient', this);

        const baseSha = await this.getHeadSha();
        console.log('baseSha', baseSha);

        const srcFolder = srcClient.normalizePath(templatePath);
        const dstFolder = this.normalizePath(targetPath);
        console.log('srcFolder', srcFolder);
        console.log('dstFolder', dstFolder);

        const tree: any[] = [];
        await this.recursiveCopyFolder(srcClient, srcFolder, srcFolder, dstFolder, message, tree);
        let entireTree = {
            base_tree: baseSha,
            tree: tree,
        };
        console.log('entireTree', entireTree);
        
        const treeSha = await this.createTree(entireTree);
        console.log('treeSha', treeSha);

        const commitSha = await this.commitTree(treeSha, message);
        console.log('commitSha', commitSha);
        
        await this.updateBranch(commitSha);
    }

    async recursiveCopyFolder(srcClient: GHClient, srcFolder: string, rootSrcFolder: string, dstFolder: string, message: string, tree: any[]): Promise<void> {
        const files = await srcClient.getFileList(srcFolder);
        console.log('copyFolder', srcFolder, dstFolder, files);
        for (const file of files) {
            const path = file.path;
            if (file.type === 'dir') {
                await this.recursiveCopyFolder(srcClient, path, rootSrcFolder, dstFolder, message, tree);
            } else {
                const content = await srcClient.getRawFile(path); // do not decode content here
                let dstPath = dstFolder + path.substring(rootSrcFolder.length);
                if (this.folder && this.folder.length > 0) {
                    dstPath = this.folder + '/' + dstPath;
                }
                tree.push({
                    path: dstPath,
                    mode: '100644',
                    type: 'blob',
                    sha: await this.createBlob(content.content),
                });
            }
        }
    }

}
