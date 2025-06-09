export function isIndexInBounds(items: any[], index: number): boolean {
    return index >= 0 && index < items.length;
  }
  
  export function randomize<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }