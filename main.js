import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import './style.css';

import GitShow from './src/index.js';
import { GHClient } from './src/fs/ghclient.js'
import { Presentation } from './src/common/presentation.js';

function setMode(mode) {
    document.getElementById('gitshow-welcome').setAttribute('class', mode);
}

function showMessage(msg) {
    document.getElementById('gitshow-message').innerHTML = msg;
}

function showStructuredMessage(msg) {
    let ret = '';
    if (msg.code) ret = ret + `<p class="code">${msg.code}</p>`;
    ret = ret + `<div class="report">${msg.message}</div>`;
    document.getElementById('gitshow-message').innerHTML = ret;
}

function authFailed() {
    console.log('AUTH FAILED');
}

async function createApiClient(service, user, repo, branch, folders) {
    let path = '';
    if (folders) {
        path = folders.join('/');
    }
    if (service === 'gh') {
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
        return apiClient;
    } else {
        console.error('Unsupported service ' + service);
        return null;
    }
}

function sanitizeName(inputString) {
    return inputString.replace(/[^a-zA-Z0-9-_]/g, '');
}

async function startPresentation(path) {
    setMode('start');
    let pdata = path.split('/');
    pdata.shift(); //the leading '/' in the path
    if (pdata.length >= 3) {
        const service = pdata[0];
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

        apiClient = await createApiClient(service, user, repo, branch, folders);
    }
    if (apiClient) {
        setMode('start loading');
        showMessage("Presentation loading...");
        let presentation = new Presentation(apiClient);
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

// Create the api client. Use the params from the path
// in the expected form /service/user/repo/path/elements
let apiClient = null;
const path = window.location.pathname;
if (path && path !== '/') {
    startPresentation(path);
}
