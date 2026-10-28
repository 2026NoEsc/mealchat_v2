const path = require('node:path');

const patched = Symbol.for('mealchat.metroWatchCompatibility');

// Expo 54's CLI still reads the pre-0.83.4 watcher payload. Keep Metro's new
// payload intact and supply the legacy view only for this pinned SDK pairing.
function installMetroWatchCompatibility() {
  if (require('@expo/cli/package.json').version !== '54.0.27' ||
      require('metro-file-map/package.json').version !== '0.83.8') return;
  const FileMap = require('metro-file-map').default;
  if (FileMap.prototype[patched]) return;
  const emit = FileMap.prototype.emit;
  FileMap.prototype.emit = function (name, payload, ...args) {
    if (name === 'change' && payload?.changes && !payload.eventsQueue) {
      const eventsQueue = [];
      const addFiles = (entries, type) => {
        for (const [file, metadata] of entries) {
          eventsQueue.push({
            type, filePath: path.resolve(payload.rootDir, file),
            metadata: { ...metadata, type: metadata.isSymlink ? 'l' : 'f' },
          });
        }
      };
      addFiles(payload.changes.addedFiles, 'add');
      addFiles(payload.changes.modifiedFiles, 'change');
      addFiles(payload.changes.removedFiles, 'delete');
      for (const [entries, type] of [
        [payload.changes.addedDirectories, 'add'],
        [payload.changes.removedDirectories, 'delete'],
      ]) {
        for (const file of entries) {
          eventsQueue.push({ type, filePath: path.resolve(payload.rootDir, file), metadata: { type: 'd' } });
        }
      }
      payload = { ...payload, eventsQueue };
    }
    return emit.call(this, name, payload, ...args);
  };
  Object.defineProperty(FileMap.prototype, patched, { value: true });
}

module.exports = { installMetroWatchCompatibility };
