import Reveal from 'reveal.js';
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js';
import RevealHighlight from 'reveal.js/plugin/highlight/highlight.esm.js';
import RevealMath from 'reveal.js/plugin/math/math.esm.js';
import RevealSearch from 'reveal.js/plugin/search/search.esm.js';
import RevealZoom from 'reveal.js/plugin/zoom/zoom.esm.js';

import GitShowRewrite from './plugin/rewrite/plugin.js';
import GitShowReferences from './plugin/references/plugin.js';
import GitShowRender from './plugin/render/plugin.js';
import GitShowMonaco from "./plugin/monaco/plugin.js";
import GitShowLayout from "./plugin/layout/plugin.js";

//let RevealSpotlight = require('./plugin/spotlight/spotlight.js');


class GitShow {

    presentation = null;
    presentationConfig = {};
    template = null;
    main = null;
    deck = null;

    /*
        Required plugins can be configured for each template in the template.json file or directly
        in the presentation.json file using the usePlugins array. The default plugins are configured
        below.
    */
    availablePlugins = [
        // built-in plugins
        RevealMarkdown,
        RevealHighlight,
        RevealNotes,
        RevealMath.MathJax2,
        RevealMath.MathJax3,
        RevealMath.KaTeX,
        RevealSearch,
        RevealZoom,
        // additional GitShow plugins
        GitShowRewrite,
        GitShowReferences,
        GitShowRender,
        GitShowMonaco,
        GitShowLayout
    ];
    availablePluginMap = {};
    usedPlugins = ['markdown', 'highlight', 'notes', 'zoom']; // default selection

    /*
        Reveal.js configuration is taken from the following sources (in the following order)
        1. The default config below
        2. Each template can update the config via updateRevealConfig()
        3. The presentation may upadte the config in the 'reveal' section of presentation.json.
    */
    revealConfig = {
        width: 1920,
        height: 1080,
        margin: 0,

        hash: true,
        center: true,
        pdfMaxPagesPerSlide: 1,
        pdfSeparateFragments: false,

        plugins: [], // to be filled after all config files are loaded
    };

    /**
     * Elements and attributes where the relative URLs are resolved. This can be extended in the template config
     * and the presentation config in the resolvedRelativeAssets array.
     */
    resolvedRelativeAssets = [
        { selector: '.reveal .slides img[src]:not([src*="://"])', attrName: 'src' },  // images
        { selector: '.reveal .slides a[href]:not([href*="://"])', attrName: 'href' }, // links
        { selector: '.reveal .slides source[src]:not([src*="://"])', attrName: 'src' },  // videos
    ];

    async init(presentation) {
        const config = presentation.getConfig();
        const template = presentation.template;
        this.presentationConfig = config;
        this.presentation = presentation;

        console.log('Welcome to GitShow!');
        console.log('https://github.com/gitshow-js');
        //console.log(this.presentationConfig);

        this.initPlugins();
        console.log('Available plugins:', Object.keys(this.availablePluginMap));

        this.main = document.getElementById('gitshow-main');
        if (config.contents) {
            this.template = this.parseTemplate(template, config);
            this.useTemplate(this.template);
            if (config.contents.length > 0) {
                await this.createContentLinks(config.contents);
            }
            if (config.reveal) {
                this.updateRevealConfig(config.reveal);
            }
            if (presentation.baseUrl) { // set base URL for relative links (assets)
                this.updateRevealConfig({markdown: {baseUrl: presentation.baseUrl}});
            }
            if (config.title) {
                this.showTitle(config.title);
            }
            if (config.usePlugins) {
                this.addPlugins(config.usePlugins);
            }
            if (config.resolvedRelativeAssets) {
                this.resolvedRelativeAssets.push(...config.resolvedRelativeAssets);
            }

            await this.runReveal();

            if (presentation.baseUrl) {
                this.resolveRelativeAssets(presentation.baseUrl);
            }

        } else {
            this.showError('Presentation config not found.');
        }
    }

    showTitle(title) {
        document.title = title;
    }

    initPlugins() {
        this.availablePluginMap = {};
        this.availablePlugins.forEach(plugin => {
            this.availablePluginMap[plugin().id] = plugin;
        });
    }

    /**
     * Adds specified plugins to the list of used plugins.
     * @param {*} pluginIds 
     */
    addPlugins(pluginIds) {
        for (const pluginId of pluginIds) {
            if (this.availablePluginMap[pluginId]) {
                if (!this.usedPlugins.includes(pluginId)) {
                    this.usedPlugins.push(pluginId);
                }
            } else {
                console.error(`Plugin '${pluginId}' not found.`);
            }
        }
    }

    /**
     * Configures Reveal.js plugins based on the usedPlugins array.
     */
    populatePlugins() {
        this.revealConfig.plugins = [];
        this.usedPlugins.forEach(pluginId => {
            const plugin = this.availablePluginMap[pluginId];
            if (plugin) {
                this.revealConfig.plugins.push(plugin);
            } else {
                console.error(`Plugin '${pluginId}' not found.`);
            }
        });
    }

    parseTemplate(template, config) {
        if (config.template?.properties) {
            template = this.replacePlaceholders(template, config.template.properties);
        }
        return template;
    }

    replacePlaceholders(template, properties) {
        if (typeof template === 'string') {
            let exactMatch = template.match(/\${(.*?)}/);
            if (exactMatch) { // exact match - return the property value
                return properties[exactMatch[1]] || exactMatch[0];
            } else { // replace in a string
                return template.replace(/\${(.*?)}/g, (match, propertyName) => {
                    return properties[propertyName] || match;
                });
            }
        } else if (Array.isArray(template)) {
            return template.map(item => this.replacePlaceholders(item, properties));
        } else if (typeof template === 'object' && template !== null) {
            const result = {};
            for (const key in template) {
                if (template.hasOwnProperty(key)) {
                    result[key] = this.replacePlaceholders(template[key], properties);
                }
            }
            return result;
        } else {
            return template;
        }
    }

    useTemplate(template) {
        console.log("USE");
        console.log(template);
        // use base CSS
        if (template.baseTheme) {
            this.addStyle('/css/theme/' + template.baseTheme + '.css');
        }
        // use custom styles
        if (template.styles) {
            for (let sname of template.styles) {
                this.importStyle('template/' + sname);
            }
        }
        // update reveal config
        if (template.reveal) {
            this.updateRevealConfig(template.reveal);
        }
        // use custom plugins
        if (template.usePlugins) {
            this.addPlugins(template.usePlugins);
        }
        // add resolved assets
        if (template.resolvedRelativeAssets) {
            this.resolvedRelativeAssets.push(...template.resolvedRelativeAssets);
        }
    }

    getPresentationConfig() {
        return this.presentationConfig;
    }

    getRevealConfig() {
        return this.revealConfig;
    }

    updateRevealConfig(newConfig) {
        this.revealConfig = { ...this.revealConfig, ...newConfig };
    }

    addStyle(path) {
        const head = document.head || document.getElementsByTagName('head')[0];
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', path);
        head.appendChild(link);
    }

    async importStyle(path) {
        let css = await this.presentation.readFile(path);
        if (css) {
            let cssdef = css.content;
            if (this.presentation.baseUrl) {
                cssdef = this.replaceUrlsWithBase(css.content, this.presentation.baseUrl);
            }
            const head = document.head || document.getElementsByTagName('head')[0];
            const style = document.createElement('style');
            style.setAttribute('type', 'text/css');
            style.innerHTML = cssdef;
            head.appendChild(style);
        } else {
            console.error('Could not read ' + path);
        }
    }

    /**
     * Replaces URLs in a CSS style sheets with the base URL.
     */
    replaceUrlsWithBase(cssString, baseUrl) {
        const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;
        const ret = cssString.replace(urlRegex, (match, url) => {
            // Check if the URL is absolute, if so, don't modify it
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
                return match;
            }
            // Prefix the URL with the base URL
            return `url('${baseUrl}template/${url}')`;
        });
        return ret;
    }

    /**
     * Resolves the relative URLs in the specified elements and attributes with the base URL.
     * @param {string} baseUrl 
     */
    resolveRelativeAssets(baseUrl) {
        for (let spec of this.resolvedRelativeAssets) {
            this.resolveRelativeAsset(spec.selector, spec.attrName, baseUrl);
        }
    }

    resolveRelativeAsset(selector, attrName, baseUrl) {
        const elements = document.querySelectorAll(selector);
        for (let elem of elements) {
            const src = elem.getAttribute(attrName);
            const newSrc = `${baseUrl}${src}`;
            elem.setAttribute(attrName, newSrc);
        }
    }

    async runReveal() {
        this.populatePlugins();
        this.deck = new Reveal(this.revealConfig);
        await this.deck.initialize();
    }

    /**
     * Creates the content sections by inserting links to markdown filed in the git repo.
     * @param {*} contents 
     */
    async createContentLinks(contents) {
        const defaultClass = this.template.defaultClass || 'normal';
        this.main.innerHTML = '';
        const reveal = document.createElement('div');
        reveal.setAttribute('class', 'reveal');
        this.main.appendChild(reveal);
        const slides = document.createElement('div');
        slides.setAttribute('class', 'slides');
        reveal.appendChild(slides);

        for (let cont of contents) {
            const fileUrl = this.presentation.baseUrl + '/' + cont;
            const slide = document.createElement('section');
            slide.setAttribute('class', defaultClass);
            slide.setAttribute('data-markdown', fileUrl);
            slide.setAttribute('data-separator', '^---');
            slide.setAttribute('data-separator-vertical', '^=--');
            slides.appendChild(slide);
        }
    }

    /**
     * Creates the content sections by fetching and inserting markdown code inline.
     * @param {*} contents 
     */
    async createContentInline(contents) {
        const defaultClass = this.template.defaultClass || 'normal';
        this.main.innerHTML = '';
        const reveal = document.createElement('div');
        reveal.setAttribute('class', 'reveal');
        this.main.appendChild(reveal);
        const slides = document.createElement('div');
        slides.setAttribute('class', 'slides');
        reveal.appendChild(slides);

        for (let cont of contents) {
            let fileData = this.presentation.getFileData(cont);
            if (fileData) {
                const slide = document.createElement('section');
                slide.setAttribute('class', defaultClass);
                slide.setAttribute('data-markdown', '');
                slide.setAttribute('data-separator', '^---');
                slide.setAttribute('data-separator-vertical', '^=--');
                //slide.innerHTML = '# Ahoj\nNazdar';
                slides.appendChild(slide);
                let md = await this.presentation.readFile(cont);
                let inslide = `<textarea data-template>${md.content}</textarea>`;
                slide.innerHTML = inslide;
            }
        }
    }

    showError(msg) {
        this.main.innerHTML = '<strong>Error:</strong> ' + msg;
    }

}

export default GitShow;
