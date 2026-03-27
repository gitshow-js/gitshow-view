
/*
    Base URL resolver for Reveal.js
    Resolves relative URLs in selected elements with the base URL.
    (c) 2025 Radek Burget <burgetr@fit.vut.cz>
 */

const Plugin = () => {

    const ASSETS_PREFIX = 'assets/';

    /**
     * Elements and attributes where the relative URLs are resolved. This can be extended in the template config
     * and the presentation config in the resolvedRelativeAssets array.
     */
    let resolvedRelativeAssets = [
        { selector: '.reveal .slides img[src]:not([src*="://"])', attrName: 'src' },  // images
        { selector: '.reveal .slides a[href]:not([href*="://"])', attrName: 'href' }, // links
        { selector: '.reveal .slides source[src]:not([src*="://"])', attrName: 'src' },  // videos
        { selector: '.reveal .slides iframe[src]:not([src*="://"])', attrName: 'src' },  // iframes
    ];

    let baseUrl;
    let deck;
    let config;
    let inlineContent;

    function resolveRelativeAssets() {
        for (let spec of resolvedRelativeAssets) {
            resolveRelativeAsset(spec.selector, spec.attrName, baseUrl);
        }
    }

    async function resolveRelativeAsset(selector, attrName, baseUrl) {
        const elements = document.querySelectorAll(selector);
        for (let elem of elements) {
            const src = elem.getAttribute(attrName);
            if (inlineContent && src.startsWith(ASSETS_PREFIX)) {
                // replace with the inline data:url
                if (config.gitShowPresentation && config.gitShowPresentation.assetsFolder) {
                    const assets = config.gitShowPresentation.assetsFolder;
                    const path = src.substring(ASSETS_PREFIX.length);
                    const file = await assets.getFileData(path);
                    if (file) {
                        const dataUrl = await assets.getDataUrl(path);
                        elem.setAttribute(attrName, dataUrl);
                    } else {
                        console.warn(`gitShow: baseurl: Failed to load asset '${src}' from folder '${assets.name}'`);
                    }
                }
            } else if (src && src.startsWith('data:')) {
                // never replace data URLs
            } else {
                // just replace relative URLs with absolute ones
                const newSrc = `${baseUrl}${src}`;
                elem.setAttribute(attrName, newSrc);
            }
        }
    }

    function initResolver(reveal) {
        deck = reveal;
        config = deck.getConfig() || {};
        inlineContent = config.gitShow && config.gitShow.inlineContent
        //console.log('gitShow: Base URL resolver initialized.', inlineContent ? 'Inlining mode' : 'External mode');
        if (config.gitShowPresentation && config.gitShowPresentation.baseUrl) {
            baseUrl = config.gitShowPresentation.baseUrl;
            //console.log('gitShow: Base URL resolver initialized with base URL:', baseUrl);

            // apply presentation-specicic resolved assets
            if (config.resolvedRelativeAssets) {
                resolvedRelativeAssets = resolvedRelativeAssets.push(...config.resolvedRelativeAssets);
            }
            // apply template-specific resolved assets
            if (config.template && config.template.resolvedRelativeAssets) {
                resolvedRelativeAssets = resolvedRelativeAssets.push(...config.template.resolvedRelativeAssets);
            }

            deck.addEventListener('ready', function(event) {
                resolveRelativeAssets();
            });
            deck.addEventListener('slidechanged', function(event) {
                resolveRelativeAssets();
            });
        } else {
            console.warn('gitShow: Base URL resolver not initialized - missing base URL in presentation config.');
        }
    }

    return {
        id: 'baseurl',
        init: function(deck) {
            initResolver(deck);
        }
    }

};

export default Plugin;
