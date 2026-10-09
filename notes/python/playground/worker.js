/* ==========================================================================
   Python 執行 Worker
   在這個 Worker 裡載入 Pyodide 並執行程式碼。
   放在 Worker 而不是主執行緒，是為了能強制終止無窮迴圈
   （主執行緒跑無窮迴圈會讓整個分頁卡死，連「停止」都按不到）。
   ========================================================================== */

const PYODIDE_VERSION = "0.28.3";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodideReady = null;

function loadPyodideOnce() {
  if (pyodideReady) return pyodideReady;
  pyodideReady = (async () => {
    importScripts(PYODIDE_URL + "pyodide.js");
    return await loadPyodide({ indexURL: PYODIDE_URL });
  })();
  return pyodideReady;
}

/* 把使用者填的輸入做成一個佇列，每次 input() 取一行 */
function makeStdin(values) {
  const q = values.slice();
  return () => (q.length ? q.shift() : "");
}

self.onmessage = async (e) => {
  const { id, code, inputs } = e.data;

  let stdout = [];
  let stderr = [];

  try {
    const py = await loadPyodideOnce();

    py.setStdin({ stdin: makeStdin(inputs) });
    py.setStdout({ batched: (s) => stdout.push(s) });
    py.setStderr({ batched: (s) => stderr.push(s) });

    let result = "";
    try {
      const r = py.runPython(code);
      if (r !== undefined && r !== null) result = String(r);
    } catch (err) {
      // 取 Python 端的 traceback，只留最後幾行比較好讀
      const msg = String(err.message || err);
      const lines = msg.trim().split("\n");
      const tail = lines.slice(-4).join("\n");
      stderr.push(tail);
    }

    self.postMessage({
      id,
      ok: true,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
      result,
      version: py.runPython("import sys; sys.version.split()[0]"),
    });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
