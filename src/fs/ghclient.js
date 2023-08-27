
const API_ROOT = 'https://api.github.com';

export class GHClient {

    CLIENT_ID = '5bc2aa3324e3cb27df55';

    username = '';
    repository = '';
    folder = '';
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

    //===================================================================================

    repositoryEndpoint() {
        return API_ROOT + '/repos/' + this.username + '/' + this.repository;
    }

    fileEndpoint(path) {
        const fpath = this.folder ? (this.folder + '/' + path) : path;
        return this.repositoryEndpoint() + '/contents/' + fpath;
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