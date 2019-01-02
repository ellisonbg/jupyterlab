/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { DisposableDelegate, IDisposable } from '@phosphor/disposable';

import { ISignal, Signal } from '@phosphor/signaling';

/**
 * An interface for an abstract dataset, with a mimetype, URI, and data.
 *
 * #### Notes
 * This interface is similar conceptually to that of nbformat.IMimeBundle,
 * but with only a single mimetype and different structure. We expect there
 * to be utilities to convert between this formats.
 */
export interface IDataset {
  /**
   * The string mimetype for the dataset.
   */
  mimeType: string;

  /**
   * A persistent URI that points to the dataset.
   *
   * #### Notes
   * This can be used by other extensions and services to maintain
   * persistent pointers to datasets across sessions. This is needed
   * as the datasets themselves are not assumed to be serializable.
   */
  uri?: string;
}

/**
 * A data registry object, for managing datasets in JupyterLab.
 */
export class DataRegistry {
  /**
   * Publish a dataset to the data registry.
   *
   * @param dataset - the `IDataset` to publish to the data registry.
   *
   * @returns A disposable which will remove the dataset.
   *
   * @throws An error if the given dataset is already published.
   */
  publish(dataset: IDataset): IDisposable {
    if (this._datasets.has(dataset)) {
      throw new Error(`Dataset already published`);
    }

    this._datasets.add(dataset);

    this._datasetsChanged.emit({ dataset, type: 'added' });

    return new DisposableDelegate(() => {
      this._datasets.delete(dataset);
      this._datasetsChanged.emit({ dataset, type: 'removed' });
    });
  }

  /**
   * Filter the published datasets using a filtering function.
   *
   * @param func - A function to use for filtering.
   *
   * @returns An set of matching `IDataset` objects.
   */
  filter<T extends IDataset>(func: (value: IDataset) => value is T): Set<T> {
    let result: Set<T> = new Set();
    this._datasets.forEach((value: T) => {
      if (func(value)) {
        result.add(value);
      }
    });
    return result;
  }

  /**
   * Return a set of all published datasets.
   */
  get datasets(): Set<IDataset> {
    return this._datasets;
  }

  /**
   * A signal that will fire when datasets are published or removed.
   */
  get datasetsChanged(): ISignal<this, DataRegistry.IDatasetsChangedArgs> {
    return this._datasetsChanged;
  }

  private _datasets: Set<IDataset> = new Set();
  private _datasetsChanged = new Signal<
    this,
    DataRegistry.IDatasetsChangedArgs
  >(this);
}

/**
 * A public namespace for the databus.
 */
export namespace DataRegistry {
  /**
   * An interface for the changed args of the dataset changed signal.
   */
  export interface IDatasetsChangedArgs {
    /**
     * The dataset begin added or removed.
     */
    readonly dataset: IDataset;

    /**
     * The type of change.
     */
    readonly type: 'added' | 'removed';
  }
}
