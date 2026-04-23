import type { CoreImage } from "../types";

const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1D];
const GB7_VERSION = 0x01;

export function decodeGB7(buffer: ArrayBuffer): CoreImage {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== GB7_SIGNATURE[i]) throw new Error("Неверная сигнатура файла GB7");
    }

    const version = view.getUint8(4);
    if (version !== GB7_VERSION) throw new Error("Неподдерживаемая верси GB7");

    const flags = view.getUint8(5);
    const hasMask = (flags & 0x01) === 1;

    const width = view.getUint16(6, false);
    const height = view.getUint16(8, false);

    const pixelDataOffset = 12;
    const imageData = new ImageData(width, height);

    for (let i = 0; i < width * height; i++) {
        const pixelByte = bytes[pixelDataOffset + i];

        const gray7 = pixelByte & 0x7F;
        const gray8 = Math.round((gray7 / 127) * 255);

        let alpha = 255;
        if (hasMask) {
            const isOpaque = (pixelByte & 0x80) !== 0;
            alpha = isOpaque ? 255 : 0;
        }

        const dataIndex = i * 4;
        imageData.data[dataIndex] = gray8;
        imageData.data[dataIndex + 1] = gray8;
        imageData.data[dataIndex + 2] = gray8;
        imageData.data[dataIndex + 3] = alpha;
    }

    return {width, height, hasMask, imageData};
}

export function encodeGB7(imageData: ImageData, hasMask: boolean): ArrayBuffer {
    const {width, height, data} = imageData;
    const bufferSize = 12 + width * height;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < 4; i++) bytes[i] = GB7_SIGNATURE[i];

    view.setUint8(4, GB7_VERSION);
    view.setUint8(5, hasMask ? 0x01 : 0x00);
    view.setUint16(6, width, false);
    view.setUint16(8, height, false);
    view.setUint16(10, 0x0000, false);

    let pixelDataOffset = 12;
    for (let i = 0; i < width * height; i++) {
        const dataIndex = i * 4;
        const r = data[dataIndex];
        const g = data[dataIndex + 1];
        const b = data[dataIndex + 2];
        const a = data[dataIndex + 3];

        const gray8 = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const gray7 = Math.round((gray8 / 255) * 127) & 0x7F;

        let maskBit = 0;
        if (hasMask && a > 127) {
        maskBit = 0x80; 
        }

        bytes[pixelDataOffset + i] = gray7 | maskBit;
    }

    return buffer;
}