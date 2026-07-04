document.addEventListener("DOMContentLoaded", () => {
  const dragArea = document.getElementById("dragArea");
  const fileInput = document.getElementById("fileInput");
  const serverUrlInput = document.getElementById("serverUrl");
  
  const statusContainer = document.getElementById("statusContainer");
  const spinner = document.getElementById("spinner");
  const successIcon = document.getElementById("successIcon");
  const errorIcon = document.getElementById("errorIcon");
  
  const statusHeading = document.getElementById("statusHeading");
  const statusDetails = document.getElementById("statusDetails");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const progressTrack = document.getElementById("progressTrack");
  
  const actionContainer = document.getElementById("actionContainer");
  const viewDashboardBtn = document.getElementById("viewDashboardBtn");

  // Load saved Server URL if any
  const savedUrl = localStorage.getItem("auto-journal-server-url");
  if (savedUrl) {
    serverUrlInput.value = savedUrl;
  } else {
    // If running in development inside the AI Studio container, try to auto-detect or default
    const currentOrigin = window.location.origin;
    if (currentOrigin && currentOrigin.includes("run.app")) {
      serverUrlInput.value = currentOrigin;
    }
  }

  // Save server URL on change
  serverUrlInput.addEventListener("change", () => {
    localStorage.setItem("auto-journal-server-url", serverUrlInput.value.trim());
  });

  // Clicking on dragArea triggers fileInput click
  dragArea.addEventListener("click", () => {
    fileInput.click();
  });

  // Drag over events
  dragArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dragArea.classList.add("active");
  });

  dragArea.addEventListener("dragleave", () => {
    dragArea.classList.remove("active");
  });

  dragArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dragArea.classList.remove("active");
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  function showStatus(type, heading, details, percent = 0) {
    statusContainer.classList.remove("hidden");
    
    // Reset icons
    spinner.classList.add("hidden");
    successIcon.classList.add("hidden");
    errorIcon.classList.add("hidden");
    progressTrack.classList.remove("hidden");
    progressPercent.classList.remove("hidden");

    if (type === "loading") {
      spinner.classList.remove("hidden");
    } else if (type === "success") {
      successIcon.classList.remove("hidden");
      progressTrack.classList.add("hidden");
      progressPercent.classList.add("hidden");
    } else if (type === "error") {
      errorIcon.classList.remove("hidden");
      progressTrack.classList.add("hidden");
      progressPercent.classList.add("hidden");
    }

    statusHeading.textContent = heading;
    statusDetails.textContent = details;
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
  }

  function handleFile(file) {
    // 1. Validation
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      showStatus("error", "Invalid File Type", "Please upload a PDF document only.");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showStatus("error", "File Too Large", "Maximum supported size is 5MB.");
      return;
    }

    // 2. Start conversion & upload
    showStatus("loading", "Processing File...", `Reading ${file.name}...`, 20);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(",")[1];
      showStatus("loading", "Extracting with AI...", "Uploading to server and analyzing PDF data...", 60);

      try {
        const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
        const response = await fetch(`${serverUrl}/api/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            filename: file.name,
            fileData: base64Data
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showStatus("success", "Analysis Complete!", `${file.name} successfully parsed.`, 100);
          actionContainer.classList.remove("hidden");
        } else {
          showStatus("error", "Processing Failed", result.error || "Failed to extract transaction data.");
        }
      } catch (error) {
        console.error("Upload error:", error);
        showStatus("error", "Network Error", "Unable to connect to the backend server. Verify your server URL.");
      }
    };

    reader.onerror = () => {
      showStatus("error", "Read Failed", "Failed to read file from your local disk.");
    };

    // Read file as Data URL (base64)
    reader.readAsDataURL(file);
  }

  // Dashboard link click
  viewDashboardBtn.addEventListener("click", () => {
    const serverUrl = serverUrlInput.value.trim();
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: serverUrl });
    } else {
      window.open(serverUrl, "_blank");
    }
  });
});
