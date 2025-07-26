import {
  parseAnimationsText,
  serializeAnimations,
} from "./boomsheets-animations";
import dedupSheet from "./dedup-sheet";
import { loadImageFile, loadTextFile } from "./file-loading";
import { InputSheet } from "./input-sheet";
import updateSheet from "./update-sheet";

const inputSheet: InputSheet = {};

function logError(error) {
  console.error(error);
  alert(error);
}

function resolveErrorMessage() {
  if (!inputSheet.image || !inputSheet.animations) {
    if (inputSheet.animationError) {
      return inputSheet.animationError;
    } else if (inputSheet.imageError) {
      return inputSheet.imageError;
    } else if (!inputSheet.animations) {
      return "Missing .animation file";
    } else if (!inputSheet.image) {
      return "Missing image file";
    }
  }

  return "";
}

function displayError() {
  const errorElement = document.querySelector("#error-text")! as HTMLElement;
  errorElement.innerText = resolveErrorMessage();
}

function gup() {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;

  try {
    const offscreenCanvas = document.createElement("canvas");
    const animations = updateSheet(offscreenCanvas, inputSheet);
    dedupSheet(canvas, offscreenCanvas, animations);
    textarea.value = serializeAnimations(animations);
  } catch (error) {
    logError(error);
  }
}

document.body.addEventListener("dragover", (event) => event.preventDefault());
document.body.addEventListener("drop", (event) => {
  const items = event.dataTransfer?.items;

  if (!items) {
    return;
  }

  event.preventDefault();

  const files: File[] = [];

  for (const item of items) {
    const file = item.getAsFile();

    if (file) {
      files.push(file);
    }
  }

  loadFiles(files)
    .catch(logError)
    .finally(() => {
      displayError();
    });
});

async function loadFiles(files: File[]) {
  for (const file of files) {
    if (file.name.endsWith(".png")) {
      try {
        inputSheet.image = await loadImageFile(file);
        inputSheet.imageError = undefined;
      } catch (error) {
        console.error(error);
        inputSheet.imageError = error!.toString();
      }
    } else if (file.name.endsWith(".animation")) {
      try {
        const text = await loadTextFile(file);

        inputSheet.animations = parseAnimationsText(text);
        inputSheet.animationError = undefined;
      } catch (error) {
        console.error(error);
        inputSheet.animationError = error!.toString();
      }
    }
  }

  if (!inputSheet.imageError && !inputSheet.animationError) {
    gup();
  }
}
