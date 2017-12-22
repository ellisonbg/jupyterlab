// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  InputCollapser, OutputCollapser
} from '@jupyterlab/cells';

import {
  Notebook
} from './widget';

import * as React from 'react';


export class NotebookInputCollapser extends InputCollapser {

  /**
   * Handle a click event for the user to collapse the cell's input.
   */
  protected handleClick(e: React.MouseEvent<HTMLDivElement>): void {
    let nb = this.parent.parent.parent as Notebook;
    nb.saveScrollTop()
    super.handleClick(e);
    nb.restoreScrollTop();
  }

}


export class NotebookOutputCollapser extends OutputCollapser {

  /**
   * Handle a click event for the user to collapse the cell's input.
   */
  protected handleClick(e: React.MouseEvent<HTMLDivElement>): void {
    let nb = this.parent.parent.parent as Notebook;
    nb.saveScrollTop()
    super.handleClick(e);
    nb.restoreScrollTop();
  }

}
