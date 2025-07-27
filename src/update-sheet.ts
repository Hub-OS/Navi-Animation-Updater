import binPack from "bin-pack";
import { BoomSheetsAnimation, BoomSheetsFrame } from "./boomsheets-animations";
import { InputSheet } from "./input-sheet";

const padding = 1;

type FrameBin = {
  overlayed: {
    frame: BoomSheetsFrame;
    offsetx: number;
    offsety: number;
  }[];
  outFrame: BoomSheetsFrame;
  width: number;
  height: number;
};

function createBinsForFrames(frames: BoomSheetsFrame[]): FrameBin[] {
  return frames.map((frame) => ({
    overlayed: [
      {
        frame,
        offsetx: 0,
        offsety: 0,
      },
    ],
    outFrame: {
      x: 0,
      y: 0,
      w: frame.w,
      h: frame.h,
      originx: frame.originx,
      originy: frame.originy,
      flipx: false,
      flipy: false,
      duration: frame.duration,
      points: frame.points,
    },
    width: 0,
    height: 0,
  }));
}

const MIGRATIONS = {
  HAND: function () {
    // delete
  },
  HILT: function () {
    // delete
  },
  CHARACTER_SWING: function (
    inputSheet: InputSheet,
    binMap: { [state: string]: FrameBin[] },
    originalAnimation: BoomSheetsAnimation
  ) {
    const hiltAnimation = inputSheet.animations!.find(
      (anim) => anim.state.toUpperCase() == "HILT"
    );

    if (hiltAnimation) {
      const bins = createBinsForFrames(originalAnimation.frames);
      let i = 1;

      bins[0].outFrame.points = [];

      for (const frame of hiltAnimation.frames) {
        let bin = bins[i++];
        const baseFrame = bin.overlayed[0].frame;
        const hiltPoint = baseFrame.points.find(
          (p) => p.label.toUpperCase() == "HILT"
        ) ?? {
          x: 0,
          y: 0,
        };

        const offsetx = hiltPoint.x - baseFrame.originx;
        const offsety = hiltPoint.y - baseFrame.originy;
        bin.overlayed.push({ frame, offsetx, offsety });

        const endPoint = frame.points.find(
          (p) => p.label.toUpperCase() == "ENDPOINT"
        );

        bin.outFrame.points = [
          {
            label: "ENDPOINT",
            x: hiltPoint.x - frame.originx + (endPoint?.x ?? 0),
            y: hiltPoint.y - frame.originy + (endPoint?.y ?? 0),
          },
        ];
      }

      binMap["CHARACTER_SWING_HILT"] = bins;
    }

    const handAnimation = inputSheet.animations!.find(
      (anim) => anim.state.toUpperCase() == "HAND"
    );

    if (handAnimation) {
      const bins = createBinsForFrames(originalAnimation.frames);
      let i = 1;

      bins[0].outFrame.points = [];

      for (const frame of handAnimation.frames) {
        let bin = bins[i++];
        const baseFrame = bin.overlayed[0].frame;
        const hiltPoint = baseFrame.points.find(
          (p) => p.label.toUpperCase() == "HILT"
        ) ?? {
          x: 0,
          y: 0,
        };

        bin.overlayed.push({
          frame,
          offsetx: hiltPoint.x - baseFrame.originx,
          offsety: hiltPoint.y - baseFrame.originy,
        });
        bin.outFrame.points = [];

        binMap["CHARACTER_SWING_HAND"] = bins;
      }
    }
  },
};

export default function updateSheet(
  canvas: HTMLCanvasElement,
  inputSheet: InputSheet
): BoomSheetsAnimation[] {
  if (!inputSheet.animations || !inputSheet.image) {
    return [];
  }

  const binMap: { [state: string]: FrameBin[] } = {};

  // create bins for the animation
  for (const animation of inputSheet.animations) {
    const migrate = MIGRATIONS[animation.state.toUpperCase()];

    if (migrate) {
      migrate(inputSheet, binMap, animation);
    } else {
      binMap[animation.state] = createBinsForFrames(animation.frames);
    }
  }

  // resolve outFrame sizes and origin
  const bins: FrameBin[] = Object.values(binMap).flat();

  for (const bin of bins) {
    // resolve origin
    const prevOriginX = bin.outFrame.originx;
    const prevOriginY = bin.outFrame.originy;

    for (const { frame, offsetx, offsety } of bin.overlayed) {
      bin.outFrame.originx = Math.max(
        bin.outFrame.originx,
        frame.originx - offsetx
      );
      bin.outFrame.originy = Math.max(
        bin.outFrame.originy,
        frame.originy - offsety
      );
    }

    // update points
    const originShiftX = bin.outFrame.originx - prevOriginX;
    const originShiftY = bin.outFrame.originy - prevOriginY;

    for (const point of bin.outFrame.points) {
      point.x -= originShiftX;
      point.y -= originShiftY;
    }

    // resolve size
    for (const { frame, offsetx, offsety } of bin.overlayed) {
      bin.outFrame.w = Math.max(
        bin.outFrame.w,
        bin.outFrame.originx - frame.originx + frame.w + offsetx
      );
      bin.outFrame.h = Math.max(
        bin.outFrame.h,
        bin.outFrame.originy - frame.originy + frame.h + offsety
      );
    }

    bin.width = bin.outFrame.w + padding * 2;
    bin.height = bin.outFrame.h + padding * 2;
  }

  // pack
  const packResult = binPack(bins);

  // update outFrames and render
  canvas.width = packResult.width;
  canvas.height = packResult.height;

  const ctx = canvas.getContext("2d")!;

  for (const item of packResult.items) {
    const destX = item.x + padding;
    const destY = item.y + padding;

    const { outFrame } = item.item;
    outFrame.x = destX;
    outFrame.y = destY;

    const image = inputSheet.image;

    for (const { frame, offsetx, offsety } of item.item.overlayed) {
      if (!image) {
        continue;
      }

      const destX = outFrame.x + outFrame.originx - frame.originx + offsetx;
      const destY = outFrame.y + outFrame.originy - frame.originy + offsety;

      ctx.save();
      ctx.translate(destX, destY);

      if (frame.flipx) {
        ctx.translate(frame.w, 0);
        ctx.scale(-1, 1);
      }

      if (frame.flipy) {
        ctx.translate(frame.h, 0);
        ctx.scale(1, -1);
      }

      ctx.drawImage(
        image,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        0,
        0,
        frame.w,
        frame.h
      );

      ctx.restore();
    }
  }

  // generate animation from bin map
  const animations: BoomSheetsAnimation[] = Object.entries(binMap).map(
    ([state, bins]) => ({
      state,
      frames: bins.map((bin) => bin.outFrame),
    })
  );

  return animations;
}
