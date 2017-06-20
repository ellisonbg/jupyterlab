// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Contents, Session
} from '@jupyterlab/services';

import {
  ArrayExt, ArrayIterator, IIterable, find, iter, map, toArray
} from '@phosphor/algorithm';

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  Widget
} from '@phosphor/widgets';

import {
  IObservableJSON, PathExt, URLExt
} from '@jupyterlab/coreutils';

import {
  IClientSession, ISanitizer, defaultSanitizer
} from '@jupyterlab/apputils';

import {
  MimeModel
} from './mimemodel';

import {
  HTMLRenderer, LatexRenderer, ImageRenderer, TextRenderer,
  JavaScriptRenderer, SVGRenderer, MarkdownRenderer, PDFRenderer
} from './renderers';

import {
  RenderedText
} from './widgets';

/**
 * A composite renderer.
 *
 * The renderer is used to render mime models using registered
 * mime renderers, selecting the preferred mime renderer to
 * render the model into a widget.
 */
export
class RenderMime {
  /**
   * Construct a renderer.
   */
  constructor(options: RenderMime.IOptions = {}) {
    if (options.items) {
      for (let item of options.items) {
        this._order.push(item.mimeType);
        this._renderers[item.mimeType] = item.renderer;
      }
    }
    this.sanitizer = options.sanitizer || defaultSanitizer;
    this._resolver = options.resolver || null;
    this._handler = options.linkHandler || null;
  }

  /**
   * The object used to resolve relative urls for the rendermime instance.
   */
  get resolver(): RenderMime.IResolver {
    return this._resolver;
  }
  set resolver(value: RenderMime.IResolver) {
    this._resolver = value;
  }

  /**
   * The object used to handle path opening links.
   */
  get linkHandler(): RenderMime.ILinkHandler {
    return this._handler;
  }
  set linkHandler(value: RenderMime.ILinkHandler) {
    this._handler = value;
  }

  /**
   * Get an iterator over the ordered list of mimeTypes.
   *
   * #### Notes
   * These mimeTypes are searched from beginning to end, and the first matching
   * mimeType is used.
   */
  mimeTypes(): IIterable<string> {
    return new ArrayIterator(this._order);
  }

  /**
   * Render a mime model.
   *
   * @param model - the mime model to render.
   *
   * #### Notes
   * Renders the model using the preferred mime type.  See
   * [[preferredMimeType]].
   */
  render(model: RenderMime.IMimeModel): Widget {
    let mimeType = this.preferredMimeType(model);
    if (!mimeType) {
      return this._handleError(model);
    }
    let rendererOptions = {
      mimeType,
      model,
      resolver: this._resolver,
      sanitizer: this.sanitizer,
      linkHandler: this._handler
    };
    return this._renderers[mimeType].render(rendererOptions);
  }

  /**
   * Find the preferred mimeType for a model.
   *
   * @param model - the mime model of interest.
   *
   * #### Notes
   * The mimeTypes in the model are checked in preference order
   * until a renderer returns `true` for `.canRender`.
   */
  preferredMimeType(model: RenderMime.IMimeModel): string {
    let sanitizer = this.sanitizer;
    return find(this._order, mimeType => {
      if (model.data.has(mimeType)) {
        let options = { mimeType, model, sanitizer };
        let renderer = this._renderers[mimeType];
        let canRender = false;
        try {
          canRender = renderer.canRender(options);
        } catch (err) {
          console.error(
            `Got an error when checking the renderer for the mimeType '${mimeType}'\n`, err);
        }
        if (canRender) {
          return true;
        }
      }
    });
  }

  /**
   * Clone the rendermime instance with shallow copies of data.
   *
   * #### Notes
   * The resolver is explicitly not cloned in this operation.
   */
  clone(): RenderMime {
    let items = toArray(map(this._order, mimeType => {
      return { mimeType, renderer: this._renderers[mimeType] };
    }));
    return new RenderMime({
      items,
      sanitizer: this.sanitizer,
      linkHandler: this._handler
    });
  }

  /**
   * Add a renderer by mimeType.
   *
   * @param item - A renderer item.
   *
   * @param index - The optional order index.
   *
   * ####Notes
   * Negative indices count from the end, so -1 refers to the last index.
   * Use the index of `.order.length` to add to the end of the render precedence list,
   * which would make the new renderer the last choice.
   * The renderer will replace an existing renderer for the given
   * mimeType.
   */
  addRenderer(item: RenderMime.IRendererItem, index = 0): void {
    let { mimeType, renderer } = item;
    let orig = ArrayExt.removeFirstOf(this._order, mimeType);
    if (orig !== -1 && orig < index) {
      index -= 1;
    }
    this._renderers[mimeType] = renderer;
    ArrayExt.insert(this._order, index, mimeType);
  }

  /**
   * Remove a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   */
  removeRenderer(mimeType: string): void {
    delete this._renderers[mimeType];
    ArrayExt.removeFirstOf(this._order, mimeType);
  }

  /**
   * Get a renderer by mimeType.
   *
   * @param mimeType - The mimeType of the renderer.
   *
   * @returns The renderer for the given mimeType, or undefined if the mimeType is unknown.
   */
  getRenderer(mimeType: string): RenderMime.IRenderer {
    return this._renderers[mimeType];
  }

  /**
   * Return a widget for an error.
   */
  private _handleError(model: RenderMime.IMimeModel): Widget {
   let errModel = new MimeModel({
      data: {
        'application/vnd.jupyter.stderr': 'Unable to render data'
      }
   });
   let options = {
      mimeType: 'application/vnd.jupyter.stderr',
      model: errModel,
      sanitizer: this.sanitizer,
    };
   return new RenderedText(options);
  }

  readonly sanitizer: ISanitizer;

  private _renderers: { [key: string]: RenderMime.IRenderer } = Object.create(null);
  private _order: string[] = [];
  private _resolver: RenderMime.IResolver | null;
  private _handler: RenderMime.ILinkHandler | null;
}


/**
 * The namespace for RenderMime statics.
 */
export
namespace RenderMime {
  /**
   * The options used to initialize a rendermime instance.
   */
  export
  interface IOptions {
    /**
     * The intial renderer items.
     */
    items?: IRendererItem[];

    /**
     * The sanitizer used to sanitize untrusted html inputs.
     *
     * If not given, a default sanitizer will be used.
     */
    sanitizer?: ISanitizer;

    /**
     * The initial resolver object.
     *
     * The default is `null`.
     */
    resolver?: IResolver;

    /**
     * An optional path handler.
     */
    linkHandler?: ILinkHandler;
  }

  /**
   * A render item.
   */
  export
  interface IRendererItem {
    /**
     * The mimeType to be renderered.
     */
    mimeType: string;

    /**
     * The renderer.
     */
    renderer: IRenderer;
  }

  /**
   * An observable model for mime data.
   */
  export
  interface IMimeModel extends IDisposable {
    /**
     * Whether the model is trusted.
     */
    readonly trusted: boolean;

    /**
     * The data associated with the model.
     */
    readonly data: IObservableJSON;

    /**
     * The metadata associated with the model.
     */
    readonly metadata: IObservableJSON;

    /**
     * Serialize the model as JSON data.
     */
    toJSON(): JSONObject;
  }

  /**
   * Get an array of the default renderer items.
   */
  export
  function getDefaultItems(): IRendererItem[] {
    let renderers = Private.defaultRenderers;
    let items: IRendererItem[] = [];
    let mimes: { [key: string]: boolean } = {};
    for (let renderer of renderers) {
      for (let mime of renderer.mimeTypes) {
        if (mime in mimes) {
          continue;
        }
        mimes[mime] = true;
        items.push({ mimeType: mime, renderer });
      }
    }
    return items;
  }

  /**
   * The options used to initialize a widget factory.
   */
  export
  interface IWidgetFactoryOptions {
    /**
     * The file extensions the widget can view.
     *
     * #### Notes
     * Use "*" to denote all files. Specific file extensions must be preceded
     * with '.', like '.png', '.txt', etc.  They may themselves contain a
     * period (e.g. .table.json).
     */
    readonly fileExtensions: string[];

    /**
     * The name of the widget to display in dialogs.
     */
    readonly name: string;

    /**
     * The file extensions for which the factory should be the default.
     *
     * #### Notes
     * Use "*" to denote all files. Specific file extensions must be preceded
     * with '.', like '.png', '.txt', etc. Entries in this attribute must also
     * be included in the fileExtensions attribute.
     * The default is an empty array.
     *
     * **See also:** [[fileExtensions]].
     */
    readonly defaultFor?: string[];

    /**
     * Whether the widget factory is read only.
     */
    readonly readOnly?: boolean;

    /**
     * The registered name of the model type used to create the widgets.
     */
    readonly modelName?: string;

    /**
     * Whether the widgets prefer having a kernel started.
     */
    readonly preferKernel?: boolean;

    /**
     * Whether the widgets can start a kernel when opened.
     */
    readonly canStartKernel?: boolean;
  }

  /**
   * An interface for using a RenderMime.IRenderer for output and read-only documents.
   */
  export
  interface IExtension {
    /**
     * The MIME type for the renderer, which is the output MIME type it will handle.
     */
    mimeType: string;

    /**
     * A renderer class to be registered to render the MIME type.
     */
    renderer: IRenderer;

    /**
     * The index passed to `RenderMime.addRenderer`.
     */
    rendererIndex?: number;

    /**
     * The timeout after user activity to re-render the data.
     */
    renderTimeout?: number;

    /**
     * The options used for using the renderer for documents.
     */
    widgetFactoryOptions?: IWidgetFactoryOptions;
  }

  /**
   * The interface for a module that exports an extension or extensions as
   * the default value.
   */
  export
  interface IExtensionModule {
    /**
     * The default export.
     */
    default: IExtension | IExtension[];
  }

  /**
   * Register a rendermime extension module.
   */
  export
  function registerExtensionModule(mod: IExtensionModule): void {
    let data = mod.default;
    // Handle commonjs exports.
    if (!mod.hasOwnProperty('__esModule')) {
      data = mod as any;
    }
    if (!Array.isArray(data)) {
      data = [data];
    }
    data.forEach(item => { Private.registeredExtensions.push(item); });
  }

  /**
   * Get the registered extensions.
   */
  export
  function getExtensions(): IIterable<IExtension> {
    return iter(Private.registeredExtensions);
  }

  /**
   * The interface for a renderer.
   */
  export
  interface IRenderer {
    /**
     * The mimeTypes this renderer accepts.
     */
    readonly mimeTypes: string[];

    /**
     * Whether the renderer can render given the render options.
     *
     * @param options - The options that would be used to render the data.
     */
    canRender(options: IRenderOptions): boolean;

    /**
     * Render the transformed mime data.
     *
     * @param options - The options used to render the data.
     */
    render(options: IRenderOptions): Widget;

    /**
     * Whether the renderer will sanitize the data given the render options.
     *
     * @param options - The options that would be used to render the data.
     */
    wouldSanitize(options: IRenderOptions): boolean;
  }

  /**
   * The options used to transform or render mime data.
   */
  export
  interface IRenderOptions {
    /**
     * The preferred mimeType to render.
     */
    mimeType: string;

    /**
     * The mime data model.
     */
    model: IMimeModel;

    /**
     * The html sanitizer.
     */
    sanitizer: ISanitizer;

    /**
     * An optional url resolver.
     */
    resolver?: IResolver;

    /**
     * An optional link handler.
     */
    linkHandler?: ILinkHandler;
  }

  /**
   * An object that handles links on a node.
   */
  export
  interface ILinkHandler {
    /**
     * Add the link handler to the node.
     */
    handleLink(node: HTMLElement, url: string): void;
  }

  /**
   * An object that resolves relative URLs.
   */
  export
  interface IResolver {
    /**
     * Resolve a relative url to a correct server path.
     */
    resolveUrl(url: string): Promise<string>;

    /**
     * Get the download url of a given absolute server path.
     */
    getDownloadUrl(path: string): Promise<string>;
  }

  /**
   * A default resolver that uses a session and a contents manager.
   */
  export
  class UrlResolver implements IResolver {
    /**
     * Create a new url resolver for a console.
     */
    constructor(options: IUrlResolverOptions) {
      this._session = options.session;
      this._contents = options.contents;
    }

    /**
     * Resolve a relative url to a correct server path.
     */
    resolveUrl(url: string): Promise<string> {
      if (URLExt.isLocal(url)) {
        let cwd = PathExt.dirname(this._session.path);
        url = PathExt.resolve(cwd, url);
      }
      return Promise.resolve(url);
    }

    /**
     * Get the download url of a given absolute server path.
     */
    getDownloadUrl(path: string): Promise<string> {
      if (URLExt.isLocal(path)) {
        return this._contents.getDownloadUrl(path);
      }
      return Promise.resolve(path);
    }

    private _session: Session.ISession | IClientSession;
    private _contents: Contents.IManager;
  }

  /**
   * The options used to create a UrlResolver.
   */
  export
  interface IUrlResolverOptions {
    /**
     * The session used by the resolver.
     */
    session: Session.ISession | IClientSession;

    /**
     * The contents manager used by the resolver.
     */
    contents: Contents.IManager;
  }
}


/**
 * The namespace for private module data.
 */
export
namespace Private {
  /**
   * The registered extensions.
   */
  export
  const registeredExtensions: RenderMime.IExtension[] = [];

  /**
   * The default renderer instances.
   */
  export
  const defaultRenderers = [
    new JavaScriptRenderer(),
    new HTMLRenderer(),
    new MarkdownRenderer(),
    new LatexRenderer(),
    new SVGRenderer(),
    new ImageRenderer(),
    new PDFRenderer(),
    new TextRenderer()
  ];
}
