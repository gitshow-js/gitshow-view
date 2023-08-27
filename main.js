import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';

import GitShow from './src/index.js';
import { GHClient } from './src/fs/ghclient.js'
import { Presentation } from './src/common/presentation.js';

function authFailed() {
    console.log('AUTH FAILED');
}

function createApiClient(service, user, repo, folders) {
    let path = '';
    if (folders) {
        path = folders.join('/');
    }
    if (service === 'gh') {
        let apiClient = new GHClient();
        apiClient.setUser(user);
        apiClient.setRepository(repo);
        apiClient.setFolder(path);
        apiClient.onNotAuthorized = authFailed;
        return apiClient;
    } else {
        console.error('Unsupported service ' + service);
        return null;
    }
}

// Create the api client. Use the params from the path
// in the expected form /service/user/repo/path/elements
let apiClient = null;
const path = window.location.pathname;
if (path) {
    let pdata = path.split('/');
    pdata.shift(); //the leading '/' in the path
    if (pdata.length >= 3) {
        const service = pdata[0];
        const user = pdata[1];
        const repo = pdata[2];
        const folders = pdata.slice(3);
        apiClient = createApiClient(service, user, repo, folders);
    }
}

if (apiClient) {
    (async () => {
        let presentation = new Presentation(apiClient);
        await presentation.refreshFolder();
        let gitShow = new GitShow();
        gitShow.init(presentation);
    })();
}
