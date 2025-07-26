declare module "bin-pack" {
  export type BinPackItem<Item> = {
    x: number; // x coordinate of the packed box
    y: number; // y coordinate of the packed box
    width: number; // width of the packed box
    height: number; // height of the packed box
    item: Item; // original object that was passed in
  };

  export type BinPackResult<Item> = {
    width: number; // width of the containing box
    height: number; // height of the containing box
    items: BinPackItem<Item>[]; // packed items
  };

  export interface Bin {
    width: number;
    height: number;
  }

  export default function binPack<T extends Bin>(items: T[]): BinPackResult<T>;
}
