# GitShow Viewer

This web application displays a [GitShow](https://github.com/gitshow-js/gitshow/) presentation from a public GitHub repository.

## Publishing your presentations

1. [Use GitShow](https://github.com/gitshow-js/gitshow#readme) to create a new markdown presentation.
2. Edit the markdown files to prepare the contents of your presentation.
3. Share the presentation sources in a public GitHub repository.
4. Go to [gitshow.net](https://gitshow.net/) and provide your GitHub repository (or a specific folder) URL.
5. You will get a direct link for showing the presentation online.

Alternatively, you may build and install your own instance of the viewer on your servers (see [Installation](https://github.com/gitshow-js/gitshow-view#installation) below).

## Demos

See [demo presentations](https://github.com/gitshow-js/demos) for a few examples of presentation sources.

## Installation

A running demo is available on [gitshow.net](https://gitshow.net/).

Building your own instance requires `node.js` and `npm` installed (e.g. from [NodeSource](https://github.com/nodesource/distributions)). You can build the viewer online using

```bash
npm run build
```

The static web files will be built in the `dist` folder. Copy the contents of the folder to the root of your web server.

## Acknowledgements

Many thanks to [Reveal.js](https://revealjs.com/) authors and contributors for creating such an awesome presentation framework.
