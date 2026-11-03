import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
// fake-indexeddb clones with Node's structuredClone, which only understands Node's Blob.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
