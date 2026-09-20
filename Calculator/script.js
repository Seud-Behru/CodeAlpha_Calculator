(() => {
  "use strict";

  /* 
     STATE
     current   : the number being typed (kept as a string so "0." works)
     previous  : the number stored when an operator is pressed
     operator  : "+", "-", "*" or "/"
     overwrite : true when the next digit should replace the display
                 (right after an operator or "=")
   */
  const state = {
    current: "0",
    previous: null,
    operator: null,
    overwrite: false,
    error: false,
    expression: ""
  };

  const MAX_DIGITS = 15;
  const SYMBOL = { "+": "+", "-": "\u2212", "*": "\u00d7", "/": "\u00f7" };
  const OPERATIONS = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b
  };

  const exprEl = document.getElementById("expr");
  const valueEl = document.getElementById("value");
  const historyEl = document.getElementById("history");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const opKeys = document.querySelectorAll(".key-op");

  const history = []; // { text, result }

  /* 
     HELPERS
   */
  // Avoids 0.1 + 0.2 = 0.30000000000000004
  const tidy = (n) => parseFloat(n.toPrecision(12));

  // 1234567.5 -> "1,234,567.5" (keeps a trailing "." while typing)
  function format(str) {
    if (str.includes("e")) return str;
    const negative = str.startsWith("-");
    const [whole, decimals] = str.replace("-", "").split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-" : "") + grouped + (decimals !== undefined ? "." + decimals : "");
  }

  function setError(message) {
    state.error = true;
    state.current = message;
    state.previous = null;
    state.operator = null;
    state.expression = "";
  }

  /* 
     ACTIONS
   */
  function clearAll() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.overwrite = false;
    state.error = false;
    state.expression = "";
  }

  function inputDigit(digit) {
    if (state.error) clearAll();
    if (state.overwrite) {
      state.current = digit;
      state.overwrite = false;
      if (!state.operator) state.expression = ""; // starting fresh after "="
    } else if (state.current === "0") {
      state.current = digit;
    } else if (state.current === "-0") {
      state.current = "-" + digit;
    } else if (state.current.replace(/[-.]/g, "").length < MAX_DIGITS) {
      state.current += digit;
    }
  }

  function inputDot() {
    if (state.error) clearAll();
    if (state.overwrite) {
      state.current = "0.";
      state.overwrite = false;
      if (!state.operator) state.expression = "";
      return;
    }
    if (!state.current.includes(".")) state.current += ".";
  }

  function chooseOperator(op) {
    if (state.error) return;
    // Chain calculations: 2 + 3 + ... evaluates 2 + 3 first
    if (state.operator && !state.overwrite) {
      evaluate();
      if (state.error) return;
    }
    state.previous = parseFloat(state.current);
    state.operator = op;
    state.overwrite = true;
    state.expression = `${format(String(state.previous))} ${SYMBOL[op]}`;
  }

  function evaluate() {
    if (state.operator === null || state.previous === null) return;

    const a = state.previous;
    const b = parseFloat(state.current);
    const op = state.operator;

    if (op === "/" && b === 0) {
      setError("Cannot divide by zero");
      return;
    }

    const result = tidy(OPERATIONS[op](a, b));
    if (!Number.isFinite(result)) {
      setError("Number too large");
      return;
    }

    const text = `${format(String(a))} ${SYMBOL[op]} ${format(String(b))}`;
    addHistory(text, result);

    state.expression = `${text} =`;
    state.current = String(result);
    state.previous = null;
    state.operator = null;
    state.overwrite = true;
  }

  function backspace() {
    if (state.error) return clearAll();
    if (state.overwrite) return; // don't edit a finished result
    const c = state.current;
    state.current = c.length <= 1 || (c.length === 2 && c.startsWith("-")) ? "0" : c.slice(0, -1);
  }

  function toggleSign() {
    if (state.error || state.current === "0") return;
    state.current = state.current.startsWith("-") ? state.current.slice(1) : "-" + state.current;
  }

  function percent() {
    if (state.error) return;
    const value = parseFloat(state.current);
    // 200 + 10 %  ->  200 + 20   (10% of 200)
    const result =
      state.previous !== null && (state.operator === "+" || state.operator === "-")
        ? (state.previous * value) / 100
        : value / 100;
    state.current = String(tidy(result));
    state.overwrite = false;
  }

  /* 
     HISTORY
   */
  function addHistory(text, result) {
    history.unshift({ text, result: String(result) });
    if (history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyEl.innerHTML = '<li class="tape-empty">Your calculations will show up here.</li>';
      return;
    }
    historyEl.innerHTML = history
      .map(
        (item, i) => `
        <li>
          <button type="button" class="tape-item" data-index="${i}" title="Use this result">
            <small>${item.text} =</small>
            <strong>${format(item.result)}</strong>
          </button>
        </li>`
      )
      .join("");
  }

  historyEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tape-item");
    if (!btn) return;
    clearAll();
    state.current = history[Number(btn.dataset.index)].result;
    state.overwrite = true;
    render();
  });

  clearHistoryBtn.addEventListener("click", () => {
    history.length = 0;
    renderHistory();
  });

  /* 
     RENDER
   */
  function render() {
    const shown = state.error ? state.current : format(state.current);
    valueEl.textContent = shown;
    exprEl.textContent = state.expression;

    valueEl.classList.toggle("is-error", state.error);
    valueEl.classList.toggle("is-long", !state.error && shown.length > 9);
    valueEl.classList.toggle("is-longer", !state.error && shown.length > 13);

    // Highlight the operator that is waiting for a second number
    opKeys.forEach((key) => {
      key.classList.toggle("is-active", state.overwrite && key.dataset.op === state.operator);
    });
  }

  /* 
     EVENTS - buttons
   */
  document.querySelector(".keys").addEventListener("click", (e) => {
    const key = e.target.closest(".key");
    if (!key) return;

    if (key.dataset.digit !== undefined) inputDigit(key.dataset.digit);
    else if (key.dataset.op) chooseOperator(key.dataset.op);
    else {
      switch (key.dataset.action) {
        case "clear": clearAll(); break;
        case "backspace": backspace(); break;
        case "percent": percent(); break;
        case "sign": toggleSign(); break;
        case "dot": inputDot(); break;
        case "equals": evaluate(); break;
      }
    }
    render();
  });

  /* 
     EVENTS - keyboard (each key press "clicks" the matching button)
   */
  const KEY_ALIASES = { "=": "Enter", ",": ".", Delete: "Escape", x: "*", X: "*" };

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const name = KEY_ALIASES[e.key] || e.key;
    const button = document.querySelector(`.key[data-key="${CSS.escape(name)}"]`);
    if (!button) return;

    e.preventDefault(); // stops "/" quick-find and Enter re-clicking a focused button
    button.click();
    button.classList.add("is-pressed");
    setTimeout(() => button.classList.remove("is-pressed"), 110);
  });

  render();
})();
