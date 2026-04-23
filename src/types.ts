export interface CoreImage {
    width: number;
    height: number;
    hasMask: boolean;
    imageData: ImageData;
}

export interface AppImage extends CoreImage {
    depth: string;
    format: string;
}