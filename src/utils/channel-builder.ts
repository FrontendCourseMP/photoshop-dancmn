import type { AppImage } from '../types';

export interface ChannelThumb {
    id: string;
    name: string;
    url: string;
}

export const buildThumbnails = async (img: AppImage): Promise<ChannelThumb[]> => {
    const makeThumb = (id: string, name: string, modifier: (d: Uint8ClampedArray) => void) => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d')!;
        
        const copy = new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height);
        modifier(copy.data);
        ctx.putImageData(copy, 0, 0);

        const thumbCanvas = document.createElement('canvas');
        const scale = Math.min(150 / img.width, 150 / img.height);
        thumbCanvas.width = img.width * scale;
        thumbCanvas.height = img.height * scale;
        thumbCanvas.getContext('2d')!.drawImage(c, 0, 0, thumbCanvas.width, thumbCanvas.height);
        
        return { id, name, url: thumbCanvas.toDataURL() };
    };

    const thumbs: ChannelThumb[] = [];
    const isGray = img.format === 'gb7';

    if (isGray) {
        thumbs.push(makeThumb('Gray', 'Серый', (d) => {
            for(let i=0; i<d.length; i+=4) d[i+3] = 255;
        }));
    } else {
        thumbs.push(makeThumb('R', 'Красный', (d) => {
            for(let i=0; i<d.length; i+=4) { d[i+1]=0; d[i+2]=0; d[i+3]=255; }
        }));
        thumbs.push(makeThumb('G', 'Зеленый', (d) => {
            for(let i=0; i<d.length; i+=4) { d[i]=0; d[i+2]=0; d[i+3]=255; }
        }));
        thumbs.push(makeThumb('B', 'Синий', (d) => {
            for(let i=0; i<d.length; i+=4) { d[i]=0; d[i+1]=0; d[i+3]=255; }
        }));
    }

    if (img.hasMask) {
        thumbs.push(makeThumb('A', 'Альфа', (d) => {
            for(let i=0; i<d.length; i+=4) {
                const a = d[i+3];
                d[i]=a; d[i+1]=a; d[i+2]=a; d[i+3]=255;
            }
        }));
    }
    return thumbs;
};

export const applyActiveChannels = (originalData: ImageData, activeIds: Set<string>, isGray: boolean): ImageData => {
    const newData = new ImageData(new Uint8ClampedArray(originalData.data), originalData.width, originalData.height);
    const d = newData.data;

    const onlyAlpha = activeIds.has('A') && activeIds.size === 1;

    for (let i = 0; i < d.length; i += 4) {
        if (onlyAlpha) {
            const alphaVal = originalData.data[i + 3];
            d[i] = alphaVal; d[i+1] = alphaVal; d[i+2] = alphaVal; d[i+3] = 255;
            continue;
        }

        if (isGray) {
            const grayActive = activeIds.has('Gray');
            d[i] = grayActive ? originalData.data[i] : 0;
            d[i+1] = grayActive ? originalData.data[i+1] : 0;
            d[i+2] = grayActive ? originalData.data[i+2] : 0;
        } else {
            d[i] = activeIds.has('R') ? originalData.data[i] : 0;
            d[i+1] = activeIds.has('G') ? originalData.data[i+1] : 0;
            d[i+2] = activeIds.has('B') ? originalData.data[i+2] : 0;
        }

        d[i+3] = activeIds.has('A') ? originalData.data[i+3] : 255;
    }

    return newData;
};