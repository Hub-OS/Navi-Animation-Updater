import { BoomSheetsAnimation } from "./boomsheets-animations";

export type InputSheet = {
  image?: HTMLImageElement;
  imageError?: string;
  animations?: BoomSheetsAnimation[];
  animationError?: string;
};
