/**
 * Polyfills for Web APIs not available in Node.js < 18
 * These are required for googleapis library to work properly
 */

// Polyfill for Headers in Node.js < 18
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init) {
      this.headers = {};
      if (init) {
        if (init instanceof Headers) {
          this.headers = { ...init.headers };
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => {
            this.headers[key.toLowerCase()] = String(value);
          });
        }
      }
    }
    
    append(name, value) {
      const key = name.toLowerCase();
      if (this.headers[key]) {
        this.headers[key] += ', ' + value;
      } else {
        this.headers[key] = String(value);
      }
    }
    
    delete(name) {
      delete this.headers[name.toLowerCase()];
    }
    
    get(name) {
      return this.headers[name.toLowerCase()] || null;
    }
    
    has(name) {
      return name.toLowerCase() in this.headers;
    }
    
    set(name, value) {
      this.headers[name.toLowerCase()] = String(value);
    }
    
    entries() {
      return Object.entries(this.headers)[Symbol.iterator]();
    }
    
    keys() {
      return Object.keys(this.headers)[Symbol.iterator]();
    }
    
    values() {
      return Object.values(this.headers)[Symbol.iterator]();
    }
    
    forEach(callback, thisArg) {
      Object.entries(this.headers).forEach(([key, value]) => {
        callback.call(thisArg, value, key, this);
      });
    }
    
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

// Polyfill for Blob in Node.js < 18
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.options = options;
      this.type = options.type || '';
      
      // Calculate size
      this.size = 0;
      for (const part of parts) {
        if (typeof part === 'string') {
          this.size += Buffer.byteLength(part, 'utf8');
        } else if (Buffer.isBuffer(part)) {
          this.size += part.length;
        } else if (part instanceof Blob) {
          this.size += part.size;
        } else if (ArrayBuffer.isView(part)) {
          this.size += part.byteLength;
        } else if (part instanceof ArrayBuffer) {
          this.size += part.byteLength;
        }
      }
    }
    
    async text() {
      const buffers = [];
      for (const part of this.parts) {
        if (typeof part === 'string') {
          buffers.push(Buffer.from(part, 'utf8'));
        } else if (Buffer.isBuffer(part)) {
          buffers.push(part);
        } else if (part instanceof Blob) {
          buffers.push(Buffer.from(await part.text(), 'utf8'));
        } else if (ArrayBuffer.isView(part)) {
          buffers.push(Buffer.from(part.buffer, part.byteOffset, part.byteLength));
        } else if (part instanceof ArrayBuffer) {
          buffers.push(Buffer.from(part));
        }
      }
      return Buffer.concat(buffers).toString('utf8');
    }
    
    async arrayBuffer() {
      const text = await this.text();
      const buffer = Buffer.from(text, 'utf8');
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    
    slice(start = 0, end = this.size, contentType = '') {
      // Simple implementation for basic slicing
      return new Blob(this.parts, { type: contentType });
    }
    
    stream() {
      // Basic stream implementation
      const { Readable } = require('stream');
      const readable = new Readable();
      
      this.text().then(text => {
        readable.push(text);
        readable.push(null);
      }).catch(err => {
        readable.destroy(err);
      });
      
      return readable;
    }
  };
}

// Polyfill for FormData in Node.js < 18
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this.data = new Map();
    }
    
    append(name, value, filename) {
      if (!this.data.has(name)) {
        this.data.set(name, []);
      }
      
      const entry = { value };
      if (filename !== undefined) {
        entry.filename = filename;
      }
      
      this.data.get(name).push(entry);
    }
    
    delete(name) {
      this.data.delete(name);
    }
    
    get(name) {
      const entries = this.data.get(name);
      return entries && entries.length > 0 ? entries[0].value : null;
    }
    
    getAll(name) {
      const entries = this.data.get(name);
      return entries ? entries.map(e => e.value) : [];
    }
    
    has(name) {
      return this.data.has(name);
    }
    
    set(name, value, filename) {
      const entry = { value };
      if (filename !== undefined) {
        entry.filename = filename;
      }
      this.data.set(name, [entry]);
    }
    
    entries() {
      const entries = [];
      for (const [name, values] of this.data.entries()) {
        for (const entry of values) {
          entries.push([name, entry.value]);
        }
      }
      return entries[Symbol.iterator]();
    }
    
    keys() {
      const keys = [];
      for (const [name, values] of this.data.entries()) {
        for (let i = 0; i < values.length; i++) {
          keys.push(name);
        }
      }
      return keys[Symbol.iterator]();
    }
    
    values() {
      const values = [];
      for (const [name, entries] of this.data.entries()) {
        for (const entry of entries) {
          values.push(entry.value);
        }
      }
      return values[Symbol.iterator]();
    }
    
    forEach(callback, thisArg) {
      for (const [name, values] of this.data.entries()) {
        for (const entry of values) {
          callback.call(thisArg, entry.value, name, this);
        }
      }
    }
    
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

// Polyfill for ReadableStream in Node.js < 18
if (typeof global.ReadableStream === 'undefined') {
  const { Readable } = require('stream');
  
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource = {}, strategy = {}) {
      this.underlyingSource = underlyingSource;
      this.strategy = strategy;
      this.locked = false;
      this.reader = null;
      
      // Create a Node.js Readable stream as the underlying implementation
      this._nodeStream = new Readable({
        start: underlyingSource.start,
        read: underlyingSource.pull,
        destroy: underlyingSource.cancel,
      });
      
      this._chunks = [];
      this._nodeStream.on('data', (chunk) => {
        this._chunks.push(chunk);
      });
      
      this._ended = false;
      this._nodeStream.on('end', () => {
        this._ended = true;
      });
      
      this._error = null;
      this._nodeStream.on('error', (err) => {
        this._error = err;
      });
    }
    
    getReader() {
      if (this.locked) {
        throw new TypeError('ReadableStream is locked');
      }
      this.locked = true;
      
      const stream = this;
      this.reader = {
        closed: new Promise((resolve, reject) => {
          stream._nodeStream.on('end', resolve);
          stream._nodeStream.on('error', reject);
        }),
        
        async read() {
          if (stream._error) {
            throw stream._error;
          }
          
          if (stream._chunks.length > 0) {
            const value = stream._chunks.shift();
            return { value, done: false };
          }
          
          if (stream._ended) {
            return { value: undefined, done: true };
          }
          
          // Wait for data
          return new Promise((resolve, reject) => {
            const onData = (chunk) => {
              cleanup();
              resolve({ value: chunk, done: false });
            };
            
            const onEnd = () => {
              cleanup();
              resolve({ value: undefined, done: true });
            };
            
            const onError = (err) => {
              cleanup();
              reject(err);
            };
            
            const cleanup = () => {
              stream._nodeStream.removeListener('data', onData);
              stream._nodeStream.removeListener('end', onEnd);
              stream._nodeStream.removeListener('error', onError);
            };
            
            stream._nodeStream.once('data', onData);
            stream._nodeStream.once('end', onEnd);
            stream._nodeStream.once('error', onError);
          });
        },
        
        releaseLock() {
          stream.locked = false;
          stream.reader = null;
        },
        
        cancel(reason) {
          stream._nodeStream.destroy(reason);
          stream.locked = false;
          stream.reader = null;
        }
      };
      
      return this.reader;
    }
    
    cancel(reason) {
      this._nodeStream.destroy(reason);
    }
    
    pipeTo(destination) {
      return new Promise((resolve, reject) => {
        this._nodeStream.pipe(destination);
        this._nodeStream.on('end', resolve);
        this._nodeStream.on('error', reject);
      });
    }
    
    pipeThrough(transform) {
      // Basic implementation
      return transform.readable;
    }
    
    tee() {
      // Create two independent readable streams
      const reader = this.getReader();
      const chunks1 = [];
      const chunks2 = [];
      
      const stream1 = new ReadableStream({
        async pull(controller) {
          if (chunks1.length > 0) {
            controller.enqueue(chunks1.shift());
            return;
          }
          const { value, done } = await reader.read();
          if (done) {
            controller.close();
          } else {
            chunks2.push(value);
            controller.enqueue(value);
          }
        }
      });
      
      const stream2 = new ReadableStream({
        async pull(controller) {
          if (chunks2.length > 0) {
            controller.enqueue(chunks2.shift());
            return;
          }
          controller.close();
        }
      });
      
      return [stream1, stream2];
    }
  };
}

module.exports = {};
