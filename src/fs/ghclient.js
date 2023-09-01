
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
        this.folder = path;
    }

    setBranch(name) {
        this.branch = name;
    }

    async useDefaultBranch() {
        this.branch = await this.getDefaultBranch();
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

    //===================================================================================

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
        const content = window.atob(data.content);
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
    

}