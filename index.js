function onDynamicContentLoaded() {
  let extensionPrefix = document.querySelectorAll("input")[0].value;
  let payload = document.querySelectorAll(".textarea")[0].textContent;
  let filePath = document.querySelectorAll("input")[1].value;
  let [exploitStatus, fileStatus] = document.querySelectorAll("span");
  let arbitraryFileContent =
    document.querySelectorAll(".textarea")[1].textContent;
  let [cancel, start] = document.querySelectorAll("button");
  function sections() {
    return document.querySelectorAll(".parent");
  }
  function sanitizeTextareaStrings() {
    let textareas = document.querySelectorAll(".textarea");
    for (let textarea in document.querySelectorAll(".textarea")) {
    }
  }
  function changeStatusMessage(message) {
    exploitStatus.textContent = ([message] || [""]).join();
  }
  function checkIfValid() {
    return new Promise((resolve, reject) => {
      resolve(Boolean(document.querySelector("input").value.length > 0));
    });
  }
  start.addEventListener("click", async function () {
    let valid = await checkIfValid();
    if (!valid) return;
    payload = document.querySelectorAll(".textarea")[0].value;
    extensionPrefix = document.querySelectorAll("input")[0].value;
    const { status } = await chrome.runtime.sendMessage({
      type: "start-inspect",
      prefix: extensionPrefix,
      payload: payload === "" ? undefined : payload,
    });
    if (!status) return changeStatusMessage("failed!");
    return changeStatusMessage(status);
  });

  cancel.addEventListener("click", async function () {
    let msg = await chrome.runtime.sendMessage({ type: "cancel-inspect" });
    if (!msg) return changeStatusMessage("failed!");
    return changeStatusMessage("canceled");
  });
  sections().forEach(function (element) {
    element.style.display = "none";
  });
  sections()[0].style.display = "block";
  var currentIndex = 0;
  function switchToNextSlide(offset) {
    sections()[currentIndex].style.display = "none";
    var oldSection = sections()[currentIndex];
    currentIndex = currentIndex + offset;
    if (currentIndex >= sections().length) {
      currentIndex = 0;
    }
    if (currentIndex < 0) {
      currentIndex = sections().length - 1;
    }
    var newIndex = currentIndex;
    var newSection = sections()[newIndex];
    newSection.style.opacity = 0;
    requestAnimationFrame(function onframe() {
      var oldSectionOldOpacity = Number(oldSection.style.opacity);
      oldSection.style.opacity = (oldSectionOldOpacity + 0.3).toString();
      newSection.style.opacity = (
        Number(newSection.style.opacity) + 1
      ).toString();
      if (
        !(Number(newSection.style.opacity) >= 1) &&
        !(Number(oldSection.style.opacity) <= 0)
      ) {
        requestAnimationFrame(onframe);
      } else {
        oldSection.style.opacity = 1;
      }
    });
    sections()[newIndex].style.display = "block";
    newIndex = currentIndex;
  }

  document.onkeydown = async function (ev) {
    if (ev.repeat) return;
    if (![document.body, document].includes(ev.target)) {
      return false;
    }
    if (ev.key === "ArrowLeft") {
      switchToNextSlide(-1);
    } else if (ev.key === "ArrowRight") {
      switchToNextSlide(1);
    }
  };

  document.addEventListener("animationend", function (e) {
    if (e.animationName === "fade-in") {
      e.target.classList.remove("did-fade-out");
    }
    if (e.animationName === "fade-out") {
      e.target.classList.add("did-fade-in");
    }
  });
}
document.addEventListener("DOMContentLoaded", onDynamicContentLoaded);
