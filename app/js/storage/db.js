// IndexedDB storage. `books` holds the small library records (title,
// progress) and `content` the chapter text, so the library list never has to
// load whole books. `pending` holds progress restored from a backup for books
// that are not on this device yet.

const DB_NAME = 'rsvp-leser';
const DB_VERSION = 2;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('content')) db.createObjectStore('content', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function run(storeNames, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = [].concat(storeNames).map((name) => tx.objectStore(name));
    let result;
    const request = work(...stores);
    if (request) request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Lagring avbrutt'));
  });
}

export const listBooks = () => run('books', 'readonly', (books) => books.getAll());
export const getBook = (id) => run('books', 'readonly', (books) => books.get(id));
export const getContent = (id) => run('content', 'readonly', (content) => content.get(id));

export function addBook(record, chapters) {
  return run(['books', 'content'], 'readwrite', (books, content) => {
    books.put(record);
    content.put({ id: record.id, chapters });
  });
}

export async function updateBook(id, changes) {
  return run('books', 'readwrite', (books) => {
    const request = books.get(id);
    request.onsuccess = () => {
      if (request.result) books.put({ ...request.result, ...changes });
    };
  });
}

export function deleteBook(id) {
  return run(['books', 'content'], 'readwrite', (books, content) => {
    books.delete(id);
    content.delete(id);
  });
}

export const listPending = () => run('pending', 'readonly', (pending) => pending.getAll());

export function putPending(records) {
  return run('pending', 'readwrite', (pending) => {
    for (const record of records) pending.put(record);
  });
}

export const deletePending = (id) => run('pending', 'readwrite', (pending) => { pending.delete(id); });
