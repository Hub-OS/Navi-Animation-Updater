import { double as quote, unquote } from "quote-unquote";

export type BoomSheetsPoint = {
  label: string;
  x: number;
  y: number;
};

export type BoomSheetsFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  originx: number;
  originy: number;
  flipx: boolean;
  flipy: boolean;
  duration: string;
  points: BoomSheetsPoint[];
};

export type BoomSheetsAnimation = {
  state: string;
  frames: BoomSheetsFrame[];
};

type Attributes = { [key: string]: string };
const nonSpaceRegex = /\S/g;
const keyEndRegex = /[\s=]/g;

function matchGRegexFrom(
  text: string,
  regex: RegExp,
  index: number
): RegExpMatchArray | null {
  regex.lastIndex = index;
  return regex.exec(text);
}

function stringCharIsEscaped(text: string, index: number): boolean {
  let escaped = false;

  while (index > 0) {
    index -= 1;

    if (text[index] != "\\") {
      break;
    }

    escaped = !escaped;
  }

  return escaped;
}

function findClosingQuote(text: string, index: number): number {
  // search for non escaped quote
  while (true) {
    if ((index = text.indexOf('"', index)) < 0) {
      return -1;
    }

    if (!stringCharIsEscaped(text, index)) {
      break;
    }

    index += 1;
  }

  return index;
}

function parseAttributes(line: string, lineNumber: number): Attributes {
  const attributes: Attributes = {};

  let index = line.indexOf(" ");

  if (index < 0) {
    // no attributes
    return attributes;
  }

  let match: RegExpMatchArray | null;

  while ((match = matchGRegexFrom(line, nonSpaceRegex, index))) {
    index = match.index!;

    // find key end
    match = matchGRegexFrom(line, keyEndRegex, index);

    if (!match) {
      throw new Error(
        `Unexpected "${line.slice(index)}" on line ${lineNumber}`
      );
    }

    const key = line.slice(index, match.index!);

    // find "="
    const eqIndex = line.indexOf("=", match.index);

    if (eqIndex < 0) {
      throw new Error(`Attribute is missing "=" on line ${lineNumber}`);
    }

    // find value start
    match = matchGRegexFrom(line, nonSpaceRegex, eqIndex + 1);

    if (!match) {
      throw new Error(`Attribute is missing value on line ${lineNumber}`);
    }

    // find value end
    let valueStart = match.index!;
    let value = "";

    if (line[valueStart] == '"') {
      // quoted value
      let valueEnd = findClosingQuote(line, valueStart + 1);

      if (valueEnd < 0) {
        throw new Error(`String missing closing quote on line ${lineNumber}`);
      }

      valueEnd += 1;

      value = unquote(line.slice(valueStart, valueEnd));
      index = valueEnd;
    } else {
      // no quotes
      let valueEnd = line.indexOf(" ", valueStart);

      if (valueEnd < 0) {
        valueEnd = line.length;
      }

      value = line.slice(valueStart, valueEnd);
      index = valueEnd;
    }

    attributes[key] = value;
  }

  return attributes;
}

export function parseAnimationsText(text: string): BoomSheetsAnimation[] {
  const animations: BoomSheetsAnimation[] = [];

  let lineNumber = 0;
  let currentAnimation: BoomSheetsAnimation | undefined;
  let currentFrame: BoomSheetsFrame | undefined;

  for (let line of text.split("\n")) {
    line = line.trim();
    lineNumber += 1;

    if (
      line == "" ||
      line.startsWith("#") ||
      line.startsWith("imagePath") ||
      line.startsWith("version")
    ) {
      // skip
      continue;
    }

    if (line.startsWith("animation ")) {
      const attributes = parseAttributes(line, lineNumber);

      const animation: BoomSheetsAnimation = {
        state: attributes.state,
        frames: [],
      };

      if (!attributes.state) {
        throw new Error(
          `Animation is missing state name on line ${lineNumber}`
        );
      }

      animations.push(animation);
      currentAnimation = animation;
    } else if (line.startsWith("frame") || line.startsWith("blank")) {
      if (!currentAnimation) {
        throw new Error(
          `No animation state to associate frame with on line ${lineNumber}`
        );
      }

      const attributes = parseAttributes(line, lineNumber);

      const frame: BoomSheetsFrame = {
        x: parseFloat(attributes.x) || 0,
        y: parseFloat(attributes.y) || 0,
        w: parseFloat(attributes.w) || 0,
        h: parseFloat(attributes.h) || 0,
        originx: parseFloat(attributes.originx) || 0,
        originy: parseFloat(attributes.originy) || 0,
        flipx: parseInt(attributes.flipx) == 1,
        flipy: parseInt(attributes.flipy) == 1,
        duration: attributes.duration || "",
        points: [],
      };

      currentAnimation.frames.push(frame);
      currentFrame = frame;
    } else if (line.startsWith("point ")) {
      if (!currentFrame) {
        throw new Error(
          `No frame to associate point with on line ${lineNumber}`
        );
      }

      const attributes = parseAttributes(line, lineNumber);

      if (!attributes.label) {
        throw new Error(`Point is missing label on line ${lineNumber}`);
      }

      const point: BoomSheetsPoint = {
        label: attributes.label,
        x: parseFloat(attributes.x),
        y: parseFloat(attributes.y),
      };

      currentFrame.points.push(point);
    } else {
      const wordEnd = line.indexOf(" ");
      const word = wordEnd < 0 ? line : line.slice(0, wordEnd);
      throw new Error(`Unexpected "${word}" on line ${lineNumber}`);
    }
  }

  return animations;
}

function serializeObject(
  name: string,
  object: Object,
  options = { quoteAllValues: true }
): string {
  const text: string[] = [name];

  for (const key in object) {
    const value = object[key];

    switch (typeof value) {
      case "string":
        if (value != "") {
          text.push(" ");
          text.push(key);
          text.push("=");
          text.push(quote(value));
        }
        break;
      case "number":
        if (value != 0) {
          if (options.quoteAllValues) {
            text.push(` ${key}="${value}"`);
          } else {
            text.push(` ${key}=${value}`);
          }
        }
        break;
      case "boolean":
        if (value == true) {
          text.push(" ");
          text.push(key);

          if (options.quoteAllValues) {
            text.push('="1"');
          } else {
            text.push("=1");
          }
        }
        break;
      case "object":
        if (Array.isArray(value)) {
          // fall through to error if the value is not an array
          break;
        }
      default:
        throw new Error(`Unexpected ${typeof value} for ${key}`);
    }
  }

  return text.join("");
}

export function serializeAnimations(animations: BoomSheetsAnimation[]): string {
  const lines: string[] = [];

  for (const animation of animations) {
    lines.push(serializeObject("animation", animation));

    for (const frame of animation.frames) {
      lines.push(serializeObject("frame", frame));

      for (const point of frame.points) {
        lines.push(serializeObject("point", point));
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
