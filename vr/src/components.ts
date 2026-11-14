import { defineComponents } from '@iwsdk/core';
import { BlocBlock, BlocLayout, BlocPanel } from './xr/components.js';

// Components the scene editor can author, and the app's own tags.
export default defineComponents([BlocBlock, BlocLayout, BlocPanel]);
