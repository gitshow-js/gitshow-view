import 'reveal.js/dist/reset.css';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import './style.css';

import GitShow from './src/index.js';
import type { ApiClient } from './src/fs/apiclient.ts';
import { GHClient } from './src/fs/gh/ghclient.ts'
import { HTTPClient } from './src/fs/http/httpclient.ts';
import { Presentation } from './src/common/presentation.ts';

import type { Coordinates, MessageCode } from './src/types.js';

let apiClient: ApiClient | null = null;
let ghAuthClient: GHClient | null = null;

function setMode(mode: string) {
    const el = document.getElementById('gitshow-welcome');
    if (el) {
        el.setAttribute('class', mode);
    }
}

function showMessage(msg: string) {
    const el = document.getElementById('gitshow-message')
    if (el) {
        el.innerHTML = msg;
    }
}

function showStructuredMessage(msg: MessageCode) {
    const el = document.getElementById('gitshow-message');
    if (el) {
        let ret = '';
        if (msg.code) {
            ret = ret + `<p class="code">${msg.code}</p>`;
        }
        if (msg.message) {
            ret = ret +
                `<div class="report">
                    <p><span class="error"></span> ${msg.message}</p>
                </div>`;
        }
        el.innerHTML = ret;
    }
}

function updateAuthWidget(client: GHClient | null): void {
    const statusEl = document.getElementById('gh-auth-status');
    const loginBtn = document.getElementById('gh-login-btn') as HTMLButtonElement | null;
    const logoutBtn = document.getElementById('gh-logout-btn') as HTMLButtonElement | null;
    if (!statusEl || !loginBtn || !logoutBtn) return;

    const loggedIn = client?.hasToken() && client?.loginStatus?.login;
    if (loggedIn) {
        statusEl.innerHTML = `Logged in as <strong>${client!.loginStatus.login}</strong>`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        statusEl.textContent = 'Not logged in';
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

function authFailed() {
    ghAuthClient = null;
    updateAuthWidget(null);
}

async function createHTTPClient(proto: string, hostname: string, folders?: string[]): Promise<HTTPClient> {
    let baseUrl = `${proto}://${hostname}`;
    if (folders) {
        baseUrl += '/' + folders.join('/');
    }
    return new HTTPClient(baseUrl);
}

async function createGHClient(user: string, repo: string, branch: string | null, folders?: string[]): Promise<GHClient> {
    let path = '';
    if (folders) {
        path = folders.join('/');
    }

    let apiClient = new GHClient();
    apiClient.setUser(user);
    apiClient.setRepository(repo);
    apiClient.setFolder(path);
    if (branch) {
        apiClient.setBranch(branch);
    } else {
        await apiClient.useDefaultBranch();
    }
    apiClient.onNotAuthorized = authFailed;
    ghAuthClient = apiClient;
    return apiClient;
}

function sanitizeName(inputString: string): string {
    return inputString.replace(/[^a-zA-Z0-9-_]/g, '');
}

function sanitizeHostname(inputString: string): string {
    return inputString.replace(/[^a-zA-Z0-9-\.]/g, '_');
}

async function startPresentation(path: string): Promise<void> {
    setMode('start');
    let pdata = path.split('/');
    pdata.shift(); //the leading '/' in the path

    if (pdata.length >= 2 && (pdata[0] === 'http' || pdata[0] === 'https')) {
        const proto = pdata[0];
        const hostname = sanitizeHostname(pdata[1]);
        const folders = pdata.slice(2);

        apiClient = await createHTTPClient(proto, hostname, folders);
    } else if (pdata.length >= 3 && pdata[0] === 'gh') {
        const user = sanitizeName(pdata[1]);
        let branch = null;
        let repo = pdata[2];
        const folders = pdata.slice(3);

        let pos = repo.indexOf('@');
        if (pos > 0) {
            branch = sanitizeName(repo.substring(pos + 1));
            repo = sanitizeName(repo.substring(0, pos));
        } else {
            repo = sanitizeName(repo);
        }

        apiClient = await createGHClient(user, repo, branch, folders);
    }

    if (apiClient) {
        setMode('start loading');
        showMessage("Presentation loading...");

        const rFolder = apiClient.createFileSet('', false);
        const tFolder = apiClient.createFileSet('template', false);
        const aFolder = apiClient.createFileSet('assets', true);
        let presentation = new Presentation(rFolder, tFolder, aFolder);
        await presentation.refreshFolder();
        if (presentation.status.ok) {
            let gitShow = new GitShow();
            await gitShow.init(presentation);
        } else {
            setMode('start');
            showStructuredMessage(presentation.status);
        }
    } else {
        showMessage('Sorry, invalid presentation coordinates. Please check your URL.');
    }
}

function parseGitHubUrl(url: string): { service: string; username: string; repo: string; branch: string; path: string } | null {
    //const githubUrlRegex = /^(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/([^/]+))?)?\/?$/;
    const githubUrlRegex = /^(?:https?:\/\/?github\.com\/)([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/?(.*)?)?$/;
    const match = url.match(githubUrlRegex);
    if (match) {
        const [, username, repo, branch, path] = match;
        return {
            service: 'gh',
            username,
            repo,
            branch,
            path,
        };
    }
    return null;
}

function parseGitHubCloneUri(uri: string): Coordinates | null {
    const githubCloneUriRegex = /^(https:\/\/github\.com|git@github\.com:)([^/]+)\/([^/]+)(?:\.git)?(?:\/tree\/([^/]+)\/?(.*)?)?$/;
    const match = uri.match(githubCloneUriRegex);
    if (match) {
        const [, , username, repo, branch, path] = match;
        return {
            service: 'gh',
            username,
            repo: repo.replace(/\.git$/, ''), // Remove '.git' if present
            branch: branch || 'master',
            path: path || '', // Allow multiple folders in the path
        };
    }

    return null;
}

function createGitShowUrl(spec: Coordinates): string {
    let ret = `${window.location.origin}/${spec.service}/${spec.username}/${spec.repo}`;
    if (spec.branch) {
        ret = ret + '@' + spec.branch;
    }
    if (spec.path) {
        ret = ret + '/' + spec.path;
    }
    return ret;
}

let destUrl: string | null = null;

const showButton = document.getElementById('gitshow-show');
const showMsg1 = document.getElementById('gitshow-show1');
const showMsg2 = document.getElementById('gitshow-show2');
const showUrl = document.getElementById('gitshow-url');
const runButton = document.getElementById('gitshow-run');

if (showButton && showMsg1 && showMsg2 && showUrl && runButton) {
    showButton.onclick = function () {
        showMsg1.style.display = 'none';
        showMsg2.style.display = 'block';
    }

    showUrl.onkeyup = function (ev) {
        const url = (ev.target as HTMLInputElement).value ?? null;
        const result = document.getElementById('gitshow-desturl');
        destUrl = null;
        if (result) {
            if (url.length > 0) {
                let urlData = parseGitHubUrl(url);
                if (!urlData) {
                    // not a GitHub URL, check for a clone URI
                    urlData = parseGitHubCloneUri(url);
                }
                if (urlData) {
                    destUrl = createGitShowUrl(urlData);
                    result.innerHTML = `Your GitShow view URL:<br><a href="${destUrl}">${destUrl}</a>`;
                    result.setAttribute('class', 'ready');
                    runButton.style.display = 'inline';
                } else {
                    result.innerHTML = 'Not a GitHub repository URL. Please open the corresponding GitHub folder in your browser and copy the URL here.';
                    result.setAttribute('class', 'notready');
                    runButton.style.display = 'none';
                }
            } else {
                result.innerHTML = '';
                result.setAttribute('class', 'empty');
                runButton.style.display = 'none';
            }
        }
    }

    runButton.onclick = function () {
        if (destUrl) {
            window.location.href = destUrl;
        }
    }
}

const ghWidget = document.getElementById('gh-auth-widget');
let ghPopupHideTimer: ReturnType<typeof setTimeout> | null = null;

function openGhPopup() {
    if (ghPopupHideTimer) { clearTimeout(ghPopupHideTimer); ghPopupHideTimer = null; }
    ghWidget?.classList.add('open');
}

function scheduleCloseGhPopup() {
    ghPopupHideTimer = setTimeout(() => ghWidget?.classList.remove('open'), 150);
}

ghWidget?.addEventListener('mouseenter', openGhPopup);
ghWidget?.addEventListener('mouseleave', scheduleCloseGhPopup);
document.getElementById('gh-auth-popup')?.addEventListener('mouseenter', openGhPopup);
document.getElementById('gh-auth-popup')?.addEventListener('mouseleave', scheduleCloseGhPopup);

document.getElementById('gh-login-btn')?.addEventListener('click', () => {
    sessionStorage.setItem('gh-auth-return', window.location.pathname);
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${new GHClient().CLIENT_ID}`;
    window.location.href = authUrl;
});

document.getElementById('gh-logout-btn')?.addEventListener('click', () => {
    ghAuthClient?.logout();
    ghAuthClient?.deleteLoginStatus();
    ghAuthClient = null;
    updateAuthWidget(null);
});

// Handle OAuth callback (GitHub redirects back with ?code=xxx)
const urlParams = new URLSearchParams(window.location.search);
const oauthCode = urlParams.get('code');
if (oauthCode) {
    history.replaceState(null, '', window.location.pathname);
    const tempClient = new GHClient();
    tempClient.loginWithAuthCode(oauthCode).then(ok => {
        if (ok) {
            tempClient.restoreLoginStatus();
            ghAuthClient = tempClient;
            const returnPath = sessionStorage.getItem('gh-auth-return');
            sessionStorage.removeItem('gh-auth-return');
            if (returnPath && returnPath !== '/') {
                window.location.pathname = returnPath;
                return;
            }
        }
        updateAuthWidget(ghAuthClient);
    });
} else {
    const tempClient = new GHClient();
    if (tempClient.hasToken()) {
        tempClient.restoreLoginStatus();
        ghAuthClient = tempClient;
    }
    updateAuthWidget(ghAuthClient);
}

// Create the api client. Use the params from the path
// in the expected form /service/user/repo/path/elements
const path = window.location.pathname;
if (path && path !== '/') {
    startPresentation(path);
}
