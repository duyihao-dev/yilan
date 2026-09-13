(function (global) {
  function isAbortError(error) {
    return !!error && (error.name === 'AbortError' || error.code === 'ABORT_ERR');
  }

  function toAbortError(signal) {
    const reason = signal?.reason;
    if (isAbortError(reason)) return reason;
    if (reason instanceof Error) {
      if (!reason.name) reason.name = 'AbortError';
      return reason;
    }

    const detail = typeof reason === 'string' && reason.trim()
      ? reason
      : 'The operation was aborted.';
    const error = new Error(detail);
    error.name = 'AbortError';
    error.reason = reason;
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) {
      throw toAbortError(signal);
    }
  }

  function raceWithAbort(promise, signal) {
    if (!signal) return Promise.resolve(promise);
    if (signal.aborted) return Promise.reject(toAbortError(signal));

    return new Promise((resolve, reject) => {
      let finished = false;

      function cleanup() {
        signal.removeEventListener('abort', onAbort);
      }

      function onAbort() {
        if (finished) return;
        finished = true;
        cleanup();
        reject(toAbortError(signal));
      }

      signal.addEventListener('abort', onAbort, { once: true });

      Promise.resolve(promise).then(
        (value) => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve(value);
        },
        (error) => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(error);
        }
      );
    });
  }

  function waitWithAbort(ms, signal) {
    if (!signal) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    if (signal.aborted) {
      return Promise.reject(toAbortError(signal));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }, ms);

      function cleanup() {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      }

      function onAbort() {
        if (settled) return;
        settled = true;
        cleanup();
        reject(toAbortError(signal));
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // Fires onTimeout after timeoutMs without a bump() call; used as a stall
  // watchdog for streamed response bodies. Timer functions are injectable so
  // tests can drive it without real delays.
  function createIdleWatchdog(options) {
    const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : 0;
    const scheduleTimer = typeof options?.setTimeoutFn === 'function' ? options.setTimeoutFn : setTimeout;
    const cancelTimer = typeof options?.clearTimeoutFn === 'function' ? options.clearTimeoutFn : clearTimeout;
    let timer = null;

    function dispose() {
      if (timer === null) return;
      cancelTimer(timer);
      timer = null;
    }

    function fire() {
      timer = null;
      if (typeof options?.onTimeout === 'function') {
        options.onTimeout();
      }
    }

    function bump() {
      if (!timeoutMs) return;
      dispose();
      timer = scheduleTimer(fire, timeoutMs);
    }

    if (timeoutMs) {
      bump();
    }

    return { bump, dispose };
  }

  const api = {
    isAbortError,
    toAbortError,
    throwIfAborted,
    raceWithAbort,
    waitWithAbort,
    createIdleWatchdog
  };

  global.AISummaryAbortUtils = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
