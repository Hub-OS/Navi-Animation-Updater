import binPack from "bin-pack";
import { BoomSheetsAnimation, BoomSheetsFrame } from "./boomsheets-animations";
import md5 from "md5";

type FrameBin = {
  frames: BoomSheetsFrame[];
  imageData: ImageData;
  width: number;
  height: number;
};

const padding = 1;

function matchBin(
  binMap: { [key: string]: FrameBin[] },
  key: string,
  frame: BoomSheetsFrame,
  imageData: ImageData
) {
  let matchingBins = binMap[key];

  if (!matchingBins) {
    matchingBins = [];
    binMap[key] = matchingBins;
  }

  for (const bin of matchingBins) {
    if (bin.frames[0].w != frame.w || bin.frames[0].h != frame.h) {
      continue;
    }

    if (!bin.imageData.data.every((b, i) => b == imageData.data[i])) {
      continue;
    }

    return bin;
  }
}

function getImageIndex(w: number, x: number, y: number) {
  return (y * w + x) * 4;
}

export default function dedupSheet(
  destCanvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  animations: BoomSheetsAnimation[]
) {
  const sourceCtx = sourceCanvas.getContext("2d")!;
  const binMap: { [key: string]: FrameBin[] } = {};

  for (const animation of animations) {
    for (const frame of animation.frames) {
      const imageData = sourceCtx.getImageData(
        frame.x,
        frame.y,
        frame.w,
        frame.h
      );
      const key = md5(imageData.data);

      let matchingBin = matchBin(binMap, key, frame, imageData);

      if (!matchingBin) {
        // try flipped, only on the x axis since it's common
        const flippedImageData = sourceCtx.getImageData(
          frame.x,
          frame.y,
          frame.w,
          frame.h
        );

        for (let y = 0; y < frame.h; y++) {
          for (let x = 0; x < frame.w; x++) {
            const i = getImageIndex(frame.w, x, y);
            const flippedI = getImageIndex(frame.w, frame.w - x - 1, y);

            for (let j = 0; j < 4; j++) {
              flippedImageData.data[i + j] = imageData.data[flippedI + j];
            }
          }
        }

        const flippedKey = md5(flippedImageData.data);
        matchingBin = matchBin(binMap, flippedKey, frame, flippedImageData);

        if (matchingBin) {
          frame.flipx = !frame.flipx;
          frame.originx = frame.w - frame.originx;
        }
      }

      if (matchingBin) {
        matchingBin.frames.push(frame);
      } else {
        binMap[key].push({
          frames: [frame],
          imageData,
          width: frame.w + padding * 2,
          height: frame.h + padding * 2,
        });
      }
    }
  }

  // pack
  const bins: FrameBin[] = Object.values(binMap).flat();
  const packResult = binPack(bins);

  // update frames and render
  destCanvas.width = packResult.width;
  destCanvas.height = packResult.height;

  const ctx = destCanvas.getContext("2d")!;

  for (const item of packResult.items) {
    const { frames } = item.item;
    const frame = item.item.frames[0];

    const destX = item.x + padding;
    const destY = item.y + padding;

    ctx.drawImage(
      sourceCanvas,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      destX,
      destY,
      frame.w,
      frame.h
    );

    for (const frame of frames) {
      frame.x = destX;
      frame.y = destY;
    }
  }

  return animations;
}
