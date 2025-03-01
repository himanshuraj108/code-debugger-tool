let watchHistory = JSON.parse(localStorage.getItem("watchHistory")) || [];

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}

let selectedHistoryIndex = null;
let visualizerEnabled = false;
let questionsEnabled = false;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("history-confirm-yes").addEventListener("click", () => {
        const code = watchHistory[selectedHistoryIndex].code;
        const codeTextArea = document.getElementById("code");
        codeTextArea.value = code;
        autoResize(codeTextArea);
        document.getElementById("history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
        toggleWatchHistory();
        selectedHistoryIndex = null;
    });

    document.getElementById("history-confirm-no").addEventListener("click", () => {
        document.getElementById("history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
        selectedHistoryIndex = null;
    });

    const visualizerToggle = document.getElementById('visualizer-toggle');
    visualizerToggle.addEventListener('click', () => {
        visualizerEnabled = !visualizerEnabled;
        visualizerToggle.classList.toggle('fa-toggle-on', visualizerEnabled);
        visualizerToggle.classList.toggle('fa-toggle-off', !visualizerEnabled);
        visualizerToggle.style.color = visualizerEnabled ? 'blue' : '';
    });

    const questionsToggle = document.getElementById('questions-toggle');
    questionsToggle.addEventListener('click', () => {
        questionsEnabled = !questionsEnabled;
        questionsToggle.classList.toggle('fa-toggle-on', questionsEnabled);
        questionsToggle.classList.toggle('fa-toggle-off', !questionsEnabled);
        questionsToggle.style.color = questionsEnabled ? 'blue' : '';
    });
});

async function debugCode() {
    const code = document.getElementById("code").value;
    const language = document.getElementById("language").value;
    const userInput = document.getElementById("user-input").value;
    const outputDiv = document.getElementById("output");
    const questionsDiv = document.getElementById("questions-list");
    const spinner = document.getElementById("spinner");
    const button = document.getElementById("runCodeBtn");
    const buttonText = document.getElementById("buttonText");
    const autoCorrectBtn = document.getElementById("autoCorrectBtn");
    const visualizationDiv = document.getElementById("visualization-output");

    outputDiv.innerHTML = "Your output will be displayed here";
    questionsDiv.innerHTML = "";
    if (questionsEnabled) spinner.style.display = "block";
    buttonText.innerHTML = "Running";
    autoCorrectBtn.style.display = "none";
    visualizationDiv.innerHTML = "";

    try {
        const response = await fetch("http://127.0.0.1:5000/debug", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, language, user_input: userInput }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.output) {
            outputDiv.innerHTML = `<pre class="success-output">${result.output}</pre>`;
        } else if (result.error) {
            document.getElementById("main-container").classList.add("blur-background");
            document.getElementById("confirmation").style.display = "flex";
            outputDiv.innerHTML = `<pre class="error-output">${result.error}</pre>`;
        }

        if (questionsEnabled && result.questions) {
            questionsDiv.innerHTML = result.questions
                .map((q) => `<li>${q}</li>`)
                .join("");
        } else {
            questionsDiv.innerHTML = "<li>No questions generated</li>";
        }

        if (visualizerEnabled && result.execution_steps) {
            animateExecution(result.execution_steps, code);
        }
    } catch (error) {
        console.error("Error during fetch operation:", error);
        outputDiv.innerHTML = `<pre class="error-output">Failed to run code. Please try again.</pre>`;
    }

    spinner.style.display = "none";
    button.disabled = true;

    try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        buttonText.innerHTML = "Run Code";
    } catch (error) {
        buttonText.innerHTML = "Run Code";
    }

    button.disabled = false;

    const historyItem = {
        code: code,
        status: result.output ? "success" : "error",
        source: "run",
    };
    watchHistory.push(historyItem);
    updateHistoryDisplay();
}

function animateExecution(steps, fullCode) {
    if (!visualizerEnabled) return;

    let stepIndex = 0;
    const codeLines = fullCode.split("\n");
    const visualizationDiv = document.getElementById("visualization-output");

    const interval = setInterval(() => {
        if (stepIndex < steps.length) {
            let highlightedCode = codeLines.map((line, index) => {
                if (index === steps[stepIndex].lineNumber) {
                    return `<span class="highlight">${line}</span>`;
                }
                return line;
            }).join("<br>");

            visualizationDiv.innerHTML = `<pre>${highlightedCode}</pre><div>${steps[stepIndex].stepDescription}</div>`;
            stepIndex++;
        } else {
            clearInterval(interval);
        }
    }, 1000);
}

// CSS for smooth transitions
const style = document.createElement('style');
style.innerHTML = `
    .highlight {
        background-color: yellow;
        transition: background-color 0.5s ease;
    }
`;
document.head.appendChild(style);

async function autoCorrectCode() {
    const code = document.getElementById("code").value;
    const correctedCodeDiv = document.getElementById("corrected-code");
    const autoCorrectText = document.getElementById("autoCorrectText");
    autoCorrectText.innerHTML = "Correcting";

    try {
        const response = await fetch("http://127.0.0.1:5000/autocorrect", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: code }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.corrected_code) {
            correctedCodeDiv.innerHTML = result.corrected_code;
            autoResize(correctedCodeDiv);
            document.getElementById("copyCorrectedCodeBtn").style.display = "block";
        } else {
            correctedCodeDiv.innerHTML = "No correction available.";
        }
    } catch (error) {
        console.error("Error during fetch operation:", error);
        correctedCodeDiv.innerHTML = "Failed to auto-correct code. Please try again.";
    }

    autoCorrectText.innerHTML = "Auto Correct";

    // Save history when auto-correct code
    const historyItem = {
        code: document.getElementById("code").value,
        status: result.corrected_code ? "auto-corrected" : "no-correction",
        source: "auto-correct",
    };
    watchHistory.push(historyItem);
    updateHistoryDisplay();
}

function copyText(elementId) {
    const element = document.getElementById(elementId);
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    const copyBtn = document.getElementById('copyCorrectedCodeBtn');
    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 2000);
}

function pasteText(elementId) {
    const element = document.getElementById(elementId);
    navigator.clipboard.readText().then(text => {
        element.value = text;
        autoResize(element);

        // Save history when paste code
        const historyItem = {
            code: text,
            status: "pasted",
            source: "paste",
        };
        watchHistory.push(historyItem);
        updateHistoryDisplay();
    });
}

function getCorrectCode() {
    document.getElementById("autoCorrectBtn").style.display = "block";
    document.getElementById("autoCorrectBtn").style.backgroundColor = "green";
    document.getElementById("autoCorrectBtn").disabled = false;
    document.getElementById("main-container").classList.remove("blur-background");
    document.getElementById("confirmation").style.display = "none";
}

function dismissConfirmation() {
    document.getElementById("main-container").classList.remove("blur-background");
    document.getElementById("confirmation").style.display = "none";
}

function toggleWatchHistory() {
    const historyDiv = document.getElementById("watch-history");
    historyDiv.style.display = historyDiv.style.display === "none" ? "block" : "none";
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById("watch-history-list");
    historyList.innerHTML = watchHistory
        .map(
            (item, index) =>
                `<li class="history-item ${item.status}" onclick="loadCodeFromHistory(${index})">
                    ${item.code}
                </li>`
        )
        .join("");
    localStorage.setItem("watchHistory", JSON.stringify(watchHistory));
}

function loadCodeFromHistory(index) {
    selectedHistoryIndex = index;
    document.getElementById("history-confirmation").style.display = "flex";
    document.getElementById("main-container").classList.add("blur-background");
}

function clearHistory() {
    document.getElementById("clear-history-confirmation").style.display = "flex";
    document.getElementById("main-container").classList.add("blur-background");

    document.getElementById("clear-history-yes").addEventListener("click", () => {
        watchHistory = [];
        localStorage.removeItem("watchHistory");
        updateHistoryDisplay();
        document.getElementById("clear-history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
    });

    document.getElementById("clear-history-no").addEventListener("click", () => {
        document.getElementById("clear-history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const modeToggle = document.querySelector('.mode-toggle');
    const modeIcon = document.getElementById('mode-icon');
    const body = document.body;

    // Add event listeners for confirmation buttons only after the DOM is fully loaded
    document.getElementById("history-confirm-yes").addEventListener("click", confirmYesHandler);
    document.getElementById("history-confirm-no").addEventListener("click", confirmNoHandler);

    function confirmYesHandler() {
        const code = watchHistory[selectedHistoryIndex].code;
        const codeTextArea = document.getElementById("code");
        codeTextArea.value = code;
        autoResize(codeTextArea);
        document.getElementById("history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
        toggleWatchHistory();
        selectedHistoryIndex = null;
    }

    function confirmNoHandler() {
        document.getElementById("history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
        selectedHistoryIndex = null;
    }

    document.getElementById("clear-history-yes").addEventListener("click", clearHistoryYesHandler);
    document.getElementById("clear-history-no").addEventListener("click", clearHistoryNoHandler);

    function clearHistoryYesHandler() {
        watchHistory = [];
        localStorage.removeItem("watchHistory");
        updateHistoryDisplay();
        document.getElementById("clear-history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
    }

    function clearHistoryNoHandler() {
        document.getElementById("clear-history-confirmation").style.display = "none";
        document.getElementById("main-container").classList.remove("blur-background");
    }
});
