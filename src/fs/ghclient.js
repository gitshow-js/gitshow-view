
const API_ROOT = 'https://api.github.com';

export class GHClient {

    CLIENT_ID = '5bc2aa3324e3cb27df55';

    username = '';
    repository = '';
    folder = '';
    branch = '';
    defaultBranch = 'main';
    onNotAuthorized = null;

    setUser(username) {
        this.username = username;
    }

    setRepository(repository) {
        this.repository = repository;
    }

    setFolder(path) {
        this.folder = this.normalizePath(path);
    }

    setBranch(name) {
        this.branch = name;
    }

    async useDefaultBranch() {
        this.branch = await this.getDefaultBranch();
    }

    normalizePath(path) {
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
    getSourceUrl() {
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
    getFolderUrl(folder) {
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

    userEndpoint(username) {
        return API_ROOT + '/users/' + username;
    }

    repositoryEndpoint() {
        return API_ROOT + '/repos/' + this.username + '/' + this.repository;
    }

    fileEndpoint(path) {
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

    async getUserRepos() {
        const response = await fetch(this.userEndpoint(this.username) + '/repos', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }

    //===================================================================================

    async fetchUser() {
        const response = await fetch(API_ROOT + '/user', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }
  
    hasToken() {
		return (localStorage.getItem('ghtoken') !== null);
	}

	logout() {
		localStorage.removeItem('ghtoken');
	}

    async getBranches() {
        const response = await fetch(this.repositoryEndpoint() + '/branches', {
            headers: this.headers(),
        });
        const data = await response.json();
        return data;
    }

    async getDefaultBranch() {
        const response = await fetch(this.repositoryEndpoint(), {
            headers: this.headers(),
        });
        const data = await response.json();
        return data.default_branch;
    }

    async login(token) {
        localStorage.setItem('ghtoken', token);
        this.loginStatus = await this.fetchUser();
        this.saveLoginStatus();
    }

    async loginWithAuthCode(code) {
        const response = await fetch('http://gitshow.net/token/?code=' + encodeURIComponent(code), {
            method: 'GET',
            headers: {
            }
        });
        const data = await response.formData();
        const accessToken = data.get('access_token');
        if (accessToken) {
            // Store the access token and mark the user as authenticated
            await this.login(accessToken);
            return true;
        }
        else {
            return false;
        }
    }

    checkAuth(response) {
		if (response.status == 401 || response.status == 403) {
			if (this.onNotAuthorized) {
				this.onNotAuthorized();
			}
			return false;
		} else {
			return true;
		}
	}

	headers(headers) {
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

    saveLoginStatus() {
		window.localStorage.setItem('gitshow-login', JSON.stringify(this.loginStatus));
	}

	deleteLoginStatus() {
		window.localStorage.removeItem('gitshow-login');
	}

	restoreLoginStatus() {
		const data = window.localStorage.getItem('gitshow-login');
		if (data) {
			this.loginStatus = JSON.parse(data);
		}
		if (this.loginStatus && this.loginStatus.http_session_token) {
			this.bearerToken = this.loginStatus.http_session_token;
		}
	}

    //===================================================================================

    async getFileList(subfolder) {
        const url = this.fileEndpoint(subfolder ? subfolder : '');
        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers(),
        });
        this.checkAuth(response);
        if (response.status >= 300) {
            throw new Error(response.statusText);
        }
        const data = await response.json();
        return data;
    }

    async getFile(path) {
        const url = this.fileEndpoint(path);
        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers(),
        });
        this.checkAuth(response);
        const data = await response.json();
        const content = this.decodeBase64Text(data.content);
        return {
            content: content,
            sha: data.sha
        }
    }

    async updateFile(path, content, sha, message) {
        const url = this.fileEndpoint(path);
        const response = await fetch(url, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify({
                message: message,
                content: window.btoa(content),
                sha: sha,
            }),
        });
        this.checkAuth(response);
        if (!response.ok) {
            throw new Error();
        }
    }
    
    // see https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    decodeBase64Text(base64) {
        const binString = window.atob(base64);
        const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
        return new TextDecoder().decode(bytes);
    }

    //===================================================================================

    /**
     * Gets the SHA of the head commit of the current branch.
     * @returns the SHA of the head commit
     */
    async getHeadSha() {
        const response = await fetch(this.repositoryEndpoint() + '/git/refs/heads/' + this.branch, {
            headers: this.headers(),
        });
        this.checkAuth(response);
        const data = await response.json();
        return data.object.sha;
    }

    /**
     * Creates a git blob.
     * @param {string} content 
     * @returns The SHA of the blob.
     */
    async createBlob(content) {
        const response = await fetch(this.repositoryEndpoint() + '/git/blobs', {
            method: 'POST',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                content: window.btoa(content),
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
    async createTree(entireTree) {
        const response = await fetch(this.repositoryEndpoint() + '/git/trees', {
            method: 'POST',
            headers: this.headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(entireTree),
        });
        this.checkAuth(response);
        const data = await response.json();
        return data.sha;
    }

    /**
     * Creates a new commit on GitHub containing a tree.
     * @param {*} treeSha the SHA of the tree
     * @param {*} message commit message
     * @returns New commit SHA.
     */
    async commitTree(treeSha, message) {
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
        return data.sha;
    }

    /**
     * Updates the current branch to the given commit.
     * @param {string} commitSha The SHA of the commit to update to.
     */
    async updateBranch(commitSha) {
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
     * Recursively copies a folder from another GitHub repository to the current repository.
     * @param {*} srcClient The source GitHub client.
     * @param {*} templatePath The source path to the template folder.
     * @param {*} targetPath Target path in this repository relative to the current folder.
     * @param {*} message Commit message.
     */
    async copyFolder(srcClient, templatePath, targetPath, message) {
        console.log('copyFolder', srcClient, templatePath, targetPath);
        console.log('destClient', this);

        const baseSha = await this.getHeadSha();
        console.log('baseSha', baseSha);

        const srcFolder = srcClient.normalizePath(templatePath);
        const dstFolder = this.normalizePath(targetPath);
        console.log('srcFolder', srcFolder);
        console.log('dstFolder', dstFolder);

        const tree = [];
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

    async recursiveCopyFolder(srcClient, srcFolder, rootSrcFolder, dstFolder, message, tree) {
        const files = await srcClient.getFileList(srcFolder);
        console.log('copyFolder', srcFolder, dstFolder, files);
        for (const file of files) {
            const path = file.path;
            if (file.type === 'dir') {
                await this.recursiveCopyFolder(srcClient, path, rootSrcFolder, dstFolder, message, tree);
            } else {
                const content = await srcClient.getFile(path);
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